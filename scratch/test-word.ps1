try {
    $word = New-Object -ComObject Word.Application
    Write-Output "Word COM Object created successfully! Version: $($word.Version)"
    $word.Quit()
} catch {
    Write-Output "Word COM not available: $($_.Exception.Message)"
}
