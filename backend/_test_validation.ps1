$bgdToken = (Get-Content "$env:TEMP\bgd_token.txt")
$dir = "0bb73a28-af6a-4b39-8048-3dda257b00d3"     # BGĐ Cường
$otherDir = "9b5c2162-ef83-413f-a702-025144b25da8" # BGĐ Tiến Anh
$mgr = "8bba632c-0f7f-4500-a565-bbc7e4801db8"       # TP Kế toán
$emp = "f735a26c-fa65-4998-ba58-1b3e148ac735"       # NV Thu mua

function Test-Task($label, $token, $assigneeId, $dept, $expect) {
  $body = @{
    name = "TEST - $label"
    department = $dept
    assigneeId = $assigneeId
    priority = "low"
    status = "not_started"
  } | ConvertTo-Json
  try {
    $r = Invoke-WebRequest -Uri "http://localhost:3000/api/tasks" -Method POST `
        -ContentType "application/json" -Body $body `
        -Headers @{Authorization = "Bearer $token"} `
        -UseBasicParsing -ErrorAction Stop
    $status = $r.StatusCode
    Write-Host "[$label] HTTP $status — UNEXPECTED $expect"
    return $false
  } catch {
    $code = $_.Exception.Response.StatusCode.value__
    $msg = ""
    try { $msg = ($_.ErrorDetails.Message | ConvertFrom-Json).error } catch {}
    Write-Host "[$label] HTTP $code — $msg"
    return ($expect -eq "BLOCK")
  }
}

# Login as TP để test rule
$loginTp = @{username='caocuong17479@gmail.com';password='123456'} | ConvertTo-Json
$tpResp = Invoke-WebRequest -Uri "http://localhost:3000/api/auth/login" -Method POST -ContentType "application/json" -Body $loginTp -UseBasicParsing
$tpToken = ($tpResp.Content | ConvertFrom-Json).token

Write-Host "`n=== BGĐ rules ==="
Test-Task "BGĐ giao NV (expect OK)"     $bgdToken $emp    "Thu mua" "OK"
Test-Task "BGĐ giao TP (expect OK)"     $bgdToken $mgr    "Kế toán" "OK"
Test-Task "BGĐ giao BGĐ khác (BLOCK)"  $bgdToken $otherDir "Ban Giám đốc" "BLOCK"

Write-Host "`n=== TP rules ==="
Test-Task "TP giao NV thuộc phòng mình (OK)"  $tpToken $emp    "Kế toán" "OK"
Test-Task "TP giao TP khác (BLOCK)"           $tpToken $mgr    "HCNS" "BLOCK"
Test-Task "TP giao BGĐ khác (BLOCK)"          $tpToken $otherDir "Ban Giám đốc" "BLOCK"

# TP giao NV phòng khác — không thuộc phòng TP
Write-Host "`n=== TP xuất phòng ==="
Test-Task "TP giao NV ngoài phòng (BLOCK)" $tpToken "5022aa18-ba65-4998-ba58-1b3e148ac700" "HCNS" "BLOCK"
