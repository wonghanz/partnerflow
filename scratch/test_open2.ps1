
    $w = New-Object -ComObject Word.Application
    $w.Visible = $false
    $w.DisplayAlerts = 0
    try {
      $d = $w.Documents.Open('C:\Users\Hanz\Downloads\umochi-squad-partnerflow (3)\umochi-squad-partnerflow\scratch\test_try2.docx', $false, $true)
      Write-Output "SUCCESS: table_with_formatting"
      $d.Close()
    } catch {
      Write-Output "FAILED: table_with_formatting - $($_.Exception.Message)"
    } finally {
      $w.Quit()
      [System.Runtime.InteropServices.Marshal]::ReleaseComObject($w) | Out-Null
    }
  