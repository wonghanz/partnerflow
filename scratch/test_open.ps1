
    $w = New-Object -ComObject Word.Application
    $w.Visible = $false
    $w.DisplayAlerts = 0
    try {
      $d = $w.Documents.Open('C:\Users\Hanz\Downloads\umochi-squad-partnerflow (3)\umochi-squad-partnerflow\scratch\test_try.docx', $false, $true)
      Write-Output "SUCCESS: p_with_shd"
      $d.Close()
    } catch {
      Write-Output "FAILED: p_with_shd - $($_.Exception.Message)"
    } finally {
      $w.Quit()
      [System.Runtime.InteropServices.Marshal]::ReleaseComObject($w) | Out-Null
    }
  