$docxPath = Join-Path (Get-Location) "CMO_Demo_Script_PartnerFlow.docx"
$word = New-Object -ComObject Word.Application
$word.Visible = $false
$word.DisplayAlerts = 0

try {
    $doc = $word.Documents.Open($docxPath, $false, $true)
    $text = $doc.Content.Text
    Write-Output "VERIFIED! Document successfully opened in Microsoft Word!"
    Write-Output "Word read $($text.Length) characters cleanly."
    $preview = $text.Substring(0, [Math]::Min(250, $text.Length)).Trim()
    Write-Output "Snippet: $preview"
    $doc.Close()
} catch {
    Write-Output "WORD FAILED TO OPEN: $($_.Exception.Message)"
} finally {
    $word.Quit()
    [System.Runtime.InteropServices.Marshal]::ReleaseComObject($word) | Out-Null
}
