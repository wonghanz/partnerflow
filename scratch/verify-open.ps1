$docxPath = Join-Path (Get-Location) "scratch\test_validated.docx"
$word = New-Object -ComObject Word.Application
$word.Visible = $false
$word.DisplayAlerts = 0

try {
    $doc = $word.Documents.Open($docxPath, $false, $true) # Open read-only
    $text = $doc.Content.Text
    Write-Output "SUCCESSFULLY OPENED IN MS WORD! Document length: $($text.Length) characters."
    Write-Output "Snippet: $($text.Trim())"
    $doc.Close()
} catch {
    Write-Output "FAILED TO OPEN: $($_.Exception.Message)"
} finally {
    $word.Quit()
    [System.Runtime.Interopservices.Marshal]::ReleaseComObject($word) | Out-Null
}
