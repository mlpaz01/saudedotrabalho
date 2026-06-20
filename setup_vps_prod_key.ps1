# Telinha local para digitar a senha root da VPS nova SEM expor no chat.
# A senha vai direto para install_key.py via pipe (memoria), instala a chave SSH
# dedicada e descarta a senha. Nada e gravado em disco.

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$dir = "C:\Users\Marcio Leandro\hostinger-projects\saudedotrabalho"

$form = New-Object System.Windows.Forms.Form
$form.Text = "Configurar acesso - VPS producao (76.13.161.14)"
$form.Size = New-Object System.Drawing.Size(440,210)
$form.StartPosition = "CenterScreen"
$form.TopMost = $true
$form.FormBorderStyle = "FixedDialog"
$form.MaximizeBox = $false; $form.MinimizeBox = $false

$lbl = New-Object System.Windows.Forms.Label
$lbl.Text = "Senha root da VPS nova (76.13.161.14):"
$lbl.Location = New-Object System.Drawing.Point(15,18)
$lbl.Size = New-Object System.Drawing.Size(400,20)
$form.Controls.Add($lbl)

$txt = New-Object System.Windows.Forms.TextBox
$txt.UseSystemPasswordChar = $true
$txt.Location = New-Object System.Drawing.Point(15,42)
$txt.Size = New-Object System.Drawing.Size(395,24)
$form.Controls.Add($txt)

$info = New-Object System.Windows.Forms.Label
$info.Text = "A senha sera usada uma vez para instalar a chave SSH e depois descartada."
$info.Location = New-Object System.Drawing.Point(15,72)
$info.Size = New-Object System.Drawing.Size(400,30)
$info.ForeColor = [System.Drawing.Color]::Gray
$form.Controls.Add($info)

$ok = New-Object System.Windows.Forms.Button
$ok.Text = "Instalar chave"; $ok.Location = New-Object System.Drawing.Point(210,115)
$ok.Size = New-Object System.Drawing.Size(120,30)
$ok.DialogResult = [System.Windows.Forms.DialogResult]::OK
$form.Controls.Add($ok); $form.AcceptButton = $ok

$cancel = New-Object System.Windows.Forms.Button
$cancel.Text = "Cancelar"; $cancel.Location = New-Object System.Drawing.Point(335,115)
$cancel.Size = New-Object System.Drawing.Size(75,30)
$cancel.DialogResult = [System.Windows.Forms.DialogResult]::Cancel
$form.Controls.Add($cancel); $form.CancelButton = $cancel

$txt.Select()
$result = $form.ShowDialog()

if ($result -eq [System.Windows.Forms.DialogResult]::OK -and $txt.Text.Length -gt 0) {
    Push-Location $dir
    $senha = $txt.Text
    $out = ($senha | python install_key.py 2>&1 | Out-String)
    $senha = $null; $txt.Text = ""
    Pop-Location
    [System.Windows.Forms.MessageBox]::Show($out, "Resultado", "OK", "Information") | Out-Null
} else {
    [System.Windows.Forms.MessageBox]::Show("Cancelado. Nenhuma alteracao feita.", "Cancelado", "OK", "Warning") | Out-Null
}
$form.Dispose()
