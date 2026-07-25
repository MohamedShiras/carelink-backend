import jwt from 'jsonwebtoken';
import { User, Patient, Doctor } from '../models/index.js';
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
      password, // also hash and save locally
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
