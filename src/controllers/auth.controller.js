import jwt from 'jsonwebtoken';
import { User, Patient, Doctor, Nurse } from '../models/index.js';
import supabase from '../config/supabase.js';

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET || 'carelink_jwt_secret', {
    expiresIn: '30d',
  });
};

export const registerUser = async (req, res, next) => {
  try {
    const { name, email, password, role, additionalInfo } = req.body;

    // Check if user already exists locally
    const userExists = await User.findOne({ where: { email } });
    if (userExists) {
      return res.status(400).json({ success: false, message: 'User already exists' });
    }

    // Sign up the user in Supabase Auth using the admin client to auto-confirm email
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name, role }
    });

    if (authError) {
      return res.status(400).json({ success: false, message: authError.message });
    }

    const authId = authData.user.id;

    // Create user in the database using the same UUID
    const user = await User.create({
      id: authId,
      name,
      email,
      password,
      role,
    });

    // Create role-specific profiles
    if (role === 'patient') {
      await Patient.create({
        userId: user.id,
        ...additionalInfo
      });
    } else if (role === 'doctor') {
      await Doctor.create({
        userId: user.id,
        specialization: additionalInfo?.specialization || 'General Physician',
        licenseNumber: additionalInfo?.licenseNumber || `LIC-${Math.floor(100000 + Math.random() * 900000)}`,
        ...additionalInfo
      });
    }

    const token = generateToken(user.id);

    // Set cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000 // 1 day default on signup
    });

    res.status(201).json({
      success: true,
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const loginUser = async (req, res, next) => {
  try {
    const { email, password, rememberMe } = req.body;

    const adminEmail = process.env.ADMIN_EMAIL || 'admin@carelink.com';

    let user;

    // Admin login path (bypasses Supabase Auth since there is no signup for admin)
    if (email === adminEmail) {
      user = await User.findOne({ where: { email, role: 'admin' } });
      if (!user || !(await user.comparePassword(password))) {
        return res.status(401).json({ success: false, message: 'Invalid email or password' });
      }
    } else {
      // Patients and Doctors use Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (authError) {
        return res.status(401).json({ success: false, message: authError.message });
      }

      // Fetch user profile from database using the Supabase UUID
      user = await User.findByPk(authData.user.id);
      if (!user) {
        return res.status(404).json({ success: false, message: 'User profile not found' });
      }

      if (user.role === 'doctor') {
        const doctor = await Doctor.findOne({ where: { userId: user.id } });
        if (doctor) {
          if (doctor.status === 'Pending') {
            return res.status(403).json({
              success: false,
              message: 'Your doctor account is pending administrator approval. Please wait for credential verification.'
            });
          }
          if (doctor.status === 'Rejected') {
            return res.status(403).json({
              success: false,
              message: `Your doctor registration was rejected. Reason: ${doctor.rejectionReason || 'Credential requirements not met.'}`
            });
          }
        }
      }

      if (user.role === 'nurse') {
        const nurse = await Nurse.findOne({ where: { userId: user.id } });
        if (nurse) {
          if (nurse.status === 'Pending') {
            return res.status(403).json({
              success: false,
              message: 'Your nurse account is pending administrator approval. Please wait for credential verification.'
            });
          }
          if (nurse.status === 'Rejected') {
            return res.status(403).json({
              success: false,
              message: `Your nurse registration was rejected. Reason: ${nurse.rejectionReason || 'Credential requirements not met.'}`
            });
          }
        }
      }
    }

    const token = generateToken(user.id);

    // Calculate cookie age (30 days if rememberMe is checked, otherwise 1 day)
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
    };

    if (rememberMe) {
      cookieOptions.maxAge = 30 * 24 * 60 * 60 * 1000; // 30 days
    } else {
      cookieOptions.maxAge = 24 * 60 * 60 * 1000; // 1 day
    }

    res.cookie('token', token, cookieOptions);

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const logoutUser = async (req, res, next) => {
  try {
    res.cookie('token', '', {
      httpOnly: true,
      expires: new Date(0),
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax'
    });
    
    // Also trigger Supabase logout if needed, ignore failures
    try {
      await supabase.auth.signOut();
    } catch (_) {}

    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    next(error);
  }
};

export const getUserProfile = async (req, res, next) => {
  try {
    const user = await User.findByPk(req.user.id, {
      attributes: { exclude: ['password'] },
      include: [
        { model: Patient, required: false },
        { model: Doctor, required: false },
      ]
    });

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.json({
      success: true,
      user,
    });
  } catch (error) {
    next(error);
  }
};

export const updateDoctorProfile = async (req, res, next) => {
  try {
    if (req.user.role !== 'doctor') {
      return res.status(403).json({ success: false, message: 'Only doctors can update doctor profile' });
    }

    const { name, specialization, licenseNumber, phone, availability } = req.body;

    if (typeof name === 'string' && name.trim()) {
      await User.update({ name: name.trim() }, { where: { id: req.user.id } });
    }

    let doctor = await Doctor.findOne({ where: { userId: req.user.id } });
    if (!doctor) {
      doctor = await Doctor.create({
        userId: req.user.id,
        specialization: specialization || 'General Physician',
        licenseNumber: licenseNumber || `LIC-${Math.floor(100000 + Math.random() * 900000)}`,
        phone,
        availability
      });
    } else {
      await doctor.update({
        specialization: specialization ?? doctor.specialization,
        licenseNumber: licenseNumber ?? doctor.licenseNumber,
        phone: phone ?? doctor.phone,
        availability: availability ?? doctor.availability
      });
    }

    const updatedUser = await User.findByPk(req.user.id, {
      attributes: { exclude: ['password'] },
      include: [{ model: Doctor, required: false }]
    });

    res.json({
      success: true,
      message: 'Doctor profile updated successfully',
      user: updatedUser
    });
  } catch (error) {
    next(error);
  }
};

export const registerDoctor = async (req, res, next) => {
  try {
    const { name, email, password, specialization, licenseNumber, phone, availability } = req.body;
    const files = req.files || {};

    if (!email || !password || !name) {
      return res.status(400).json({ success: false, message: 'Name, email, and password are required.' });
    }

    const userExists = await User.findOne({ where: { email } });
    if (userExists) {
      return res.status(400).json({ success: false, message: 'An account with this email already exists.' });
    }

    const medicalLicenseFile = files['medicalLicense'] ? files['medicalLicense'][0] : null;
    if (!medicalLicenseFile) {
      return res.status(400).json({ success: false, message: 'Medical License PDF document is required.' });
    }

    const isPdf = medicalLicenseFile.mimetype === 'application/pdf' || medicalLicenseFile.originalname.toLowerCase().endsWith('.pdf');
    if (!isPdf) {
      return res.status(400).json({ success: false, message: 'Medical License must be a PDF file (.pdf).' });
    }

    const nicFrontFile = files['nicFront'] ? files['nicFront'][0] : null;
    const nicBackFile = files['nicBack'] ? files['nicBack'][0] : null;

    if (!nicFrontFile || !nicBackFile) {
      return res.status(400).json({ success: false, message: 'Both NIC Front and NIC Back documents are required.' });
    }

    const bucketName = 'doctor-credentials';
    try {
      const { data: buckets } = await supabase.storage.listBuckets();
      if (!buckets?.some(b => b.name === bucketName)) {
        await supabase.storage.createBucket(bucketName, { public: true });
      }
    } catch (bErr) {
      console.warn('Bucket check error:', bErr.message);
    }

    const uploadDocument = async (file, label) => {
      if (!file) return null;
      const ext = file.originalname.split('.').pop();
      const filename = `doc_${label}_${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`;
      const { error } = await supabase.storage
        .from(bucketName)
        .upload(filename, file.buffer, { contentType: file.mimetype, upsert: true });

      if (error) {
        console.warn(`Failed to upload ${label}:`, error.message);
      }
      const urlRes = supabase.storage.from(bucketName).getPublicUrl(filename);
      return urlRes.data?.publicUrl || `https://cxwsiznzjvwiboygnljg.supabase.co/storage/v1/object/public/${bucketName}/${filename}`;
    };

    const nicFrontUrl = await uploadDocument(nicFrontFile, 'nic_front');
    const nicBackUrl = await uploadDocument(nicBackFile, 'nic_back');
    const licenseDocumentUrl = await uploadDocument(medicalLicenseFile, 'license_pdf');

    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name, role: 'doctor' }
    });

    if (authError) {
      return res.status(400).json({ success: false, message: authError.message });
    }

    const authId = authData.user.id;

    const user = await User.create({
      id: authId,
      name,
      email,
      password,
      role: 'doctor'
    });

    const doctor = await Doctor.create({
      userId: user.id,
      specialization: specialization || 'General Physician',
      licenseNumber: licenseNumber || `LIC-${Math.floor(100000 + Math.random() * 900000)}`,
      phone: phone || '',
      availability: availability || 'Mon - Fri (09:00 - 17:00)',
      status: 'Pending',
      nicFrontUrl,
      nicBackUrl,
      licenseDocumentUrl
    });

    res.status(201).json({
      success: true,
      message: 'Doctor registration request submitted! Your credentials are under review by the Administrator.',
      data: {
        id: user.id,
        name: user.name,
        email: user.email,
        status: doctor.status
      }
    });
  } catch (error) {
    next(error);
  }
};

export const registerNurse = async (req, res, next) => {
  try {
    const { name, email, password, department, licenseNumber, phone } = req.body;
    const files = req.files || {};

    if (!email || !password || !name) {
      return res.status(400).json({ success: false, message: 'Name, email, and password are required.' });
    }

    const userExists = await User.findOne({ where: { email } });
    if (userExists) {
      return res.status(400).json({ success: false, message: 'An account with this email already exists.' });
    }

    const nursingLicenseFile = files['nursingLicense'] ? files['nursingLicense'][0] : null;
    if (!nursingLicenseFile) {
      return res.status(400).json({ success: false, message: 'Nursing License PDF document is required.' });
    }

    const isPdf = nursingLicenseFile.mimetype === 'application/pdf' || nursingLicenseFile.originalname.toLowerCase().endsWith('.pdf');
    if (!isPdf) {
      return res.status(400).json({ success: false, message: 'Nursing License must be a PDF file (.pdf).' });
    }

    const nicFrontFile = files['nicFront'] ? files['nicFront'][0] : null;
    const nicBackFile = files['nicBack'] ? files['nicBack'][0] : null;
    const cvFile = files['cvDocument'] ? files['cvDocument'][0] : null;

    if (!nicFrontFile || !nicBackFile) {
      return res.status(400).json({ success: false, message: 'Both NIC Front and NIC Back documents are required.' });
    }

    if (!cvFile) {
      return res.status(400).json({ success: false, message: 'Nurse CV / Resume document is required.' });
    }

    const bucketName = 'nurse-credentials';
    try {
      const { data: buckets } = await supabase.storage.listBuckets();
      if (!buckets?.some(b => b.name === bucketName)) {
        await supabase.storage.createBucket(bucketName, { public: true });
      }
    } catch (bErr) {
      console.warn('Bucket check error:', bErr.message);
    }

    const uploadDocument = async (file, label) => {
      if (!file) return null;
      const ext = file.originalname.split('.').pop();
      const filename = `nurse_${label}_${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`;
      const { error } = await supabase.storage
        .from(bucketName)
        .upload(filename, file.buffer, { contentType: file.mimetype, upsert: true });

      if (error) {
        console.warn(`Failed to upload ${label}:`, error.message);
      }
      const urlRes = supabase.storage.from(bucketName).getPublicUrl(filename);
      return urlRes.data?.publicUrl || `https://cxwsiznzjvwiboygnljg.supabase.co/storage/v1/object/public/${bucketName}/${filename}`;
    };

    const nicFrontUrl = await uploadDocument(nicFrontFile, 'nic_front');
    const nicBackUrl = await uploadDocument(nicBackFile, 'nic_back');
    const licenseDocumentUrl = await uploadDocument(nursingLicenseFile, 'license_pdf');
    const cvDocumentUrl = await uploadDocument(cvFile, 'cv_doc');

    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name, role: 'nurse' }
    });

    if (authError) {
      return res.status(400).json({ success: false, message: authError.message });
    }

    const authId = authData.user.id;

    const user = await User.create({
      id: authId,
      name,
      email,
      password,
      role: 'nurse'
    });

    const nurse = await Nurse.create({
      userId: user.id,
      department: department || 'General Ward',
      licenseNumber: licenseNumber || `NUR-${Math.floor(100000 + Math.random() * 900000)}`,
      phone: phone || '',
      status: 'Pending',
      nicFrontUrl,
      nicBackUrl,
      licenseDocumentUrl,
      cvDocumentUrl
    });

    res.status(201).json({
      success: true,
      message: 'Nurse registration request submitted! Your credentials and CV are under review by the Administrator.',
      data: {
        id: user.id,
        name: user.name,
        email: user.email,
        status: nurse.status
      }
    });
  } catch (error) {
    next(error);
  }
};
