$lines = Get-Content 'training_data.csv' -Encoding UTF8
$allDiseases = @()
foreach ($line in ($lines | Select-Object -Skip 1)) {
    $trimmed = $line.TrimEnd(',').TrimEnd()
    $idx = $trimmed.LastIndexOf(',')
    if ($idx -gt 0) {
        $allDiseases += $trimmed.Substring($idx + 1).Trim()
    }
}
$allDiseases | Sort-Object -Unique
