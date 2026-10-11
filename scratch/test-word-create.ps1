$ErrorActionPreference = "Stop"

$word = New-Object -ComObject Word.Application
$word.Visible = $false
$word.DisplayAlerts = 0

try {
    $doc = $word.Documents.Add()
    $selection = $word.Selection

    $selection.Font.Name = "Arial"
    $selection.Font.Size = 20
    $selection.Font.Bold = 1
    $selection.Font.Color = 0x8A3A1E # BGR: 1E3A8A navy
    $selection.TypeText("PartnerFlow AI — CMO Executive Demo Script`n")

    $selection.Font.Name = "Calibri"
    $selection.Font.Size = 12
    $selection.Font.Bold = 0
    $selection.Font.Color = 0x333333
    $selection.TypeText("Test Word COM export works.`n")

    $testFile = Join-Path (Get-Location) "scratch\test_com.docx"
    if (Test-Path $testFile) { Remove-Item $testFile -Force }

    $doc.SaveAs2($testFile, 16)
    $doc.Close()
    Write-Output "Successfully saved native DOCX to: $testFile"
} finally {
    $word.Quit()
    [System.Runtime.Interopservices.Marshal]::ReleaseComObject($word) | Out-Null
}
