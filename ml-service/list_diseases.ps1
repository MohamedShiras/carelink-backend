$lines = Get-Content -Path 'training_data.csv' | Select-Object -Skip 1
$diseases = @()
foreach ($line in $lines) {
    $trimmed = $line.TrimEnd(',').Trim()
    $idx = $trimmed.LastIndexOf(',')
    if ($idx -gt 0) {
        $diseases += $trimmed.Substring($idx + 1).Trim()
    }
}
$diseases | Sort-Object -Unique
