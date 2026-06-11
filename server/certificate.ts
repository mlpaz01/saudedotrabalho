import { createCanvas, loadImage } from "@napi-rs/canvas";
import QRCode from "qrcode";

interface CertificateData {
  userName: string;
  moduleName: string;
  completedAt: Date;
  certificateCode: string;
  // Optional per-module customization
  certTitle?: string | null;    // override for "CERTIFICADO DE CONCLUSÃO"
  certBody?: string | null;     // custom body text (shown below module name)
  certSignerName?: string | null;
  certSignerRole?: string | null;
}

export async function generateCertificatePDF(data: CertificateData): Promise<Buffer> {
  const width = 1200;
  const height = 850;

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  // Background gradient — lavanda/menta suave
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, "#f5f3ff");
  gradient.addColorStop(0.5, "#f0f7f4");
  gradient.addColorStop(1, "#e8f4f8");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  // Outer border — azul-marinho
  ctx.strokeStyle = "#1e3a5f";
  ctx.lineWidth = 8;
  ctx.strokeRect(30, 30, width - 60, height - 60);

  // Inner border — verde-folha
  ctx.strokeStyle = "#2d7a5f";
  ctx.lineWidth = 2;
  ctx.strokeRect(48, 48, width - 96, height - 96);

  // Corner bracket decorations
  const corners: [number, number][] = [
    [70, 70],
    [width - 70, 70],
    [70, height - 70],
    [width - 70, height - 70],
  ];
  corners.forEach(([x, y]) => {
    const dir = x < width / 2 ? 1 : -1;
    const vdir = y < height / 2 ? 1 : -1;
    ctx.strokeStyle = "#1e3a5f";
    ctx.lineWidth = 3;
    // Horizontal arm
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + dir * 30, y);
    ctx.stroke();
    // Vertical arm
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x, y + vdir * 30);
    ctx.stroke();
  });

  // Header — company name
  ctx.fillStyle = "#1e3a5f";
  ctx.font = "bold 30px serif";
  ctx.textAlign = "center";
  ctx.fillText("SAÚDE DO TRABALHO", width / 2, 140);

  ctx.fillStyle = "#2d7a5f";
  ctx.font = "16px sans-serif";
  ctx.fillText("Plataforma de Saúde Mental e Bem-Estar Corporativo", width / 2, 170);

  // Divider line
  ctx.strokeStyle = "#1e3a5f";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(120, 192);
  ctx.lineTo(width - 120, 192);
  ctx.stroke();

  // Certificate title (customizable, default gender-neutral)
  const certTitle = data.certTitle?.trim() || "CERTIFICADO DE CONCLUSÃO";
  ctx.fillStyle = "#1e3a5f";
  ctx.font = "bold 52px serif";
  ctx.fillText(certTitle, width / 2, 278);

  // Certify text
  ctx.fillStyle = "#666";
  ctx.font = "20px sans-serif";
  ctx.fillText("Certificamos que", width / 2, 340);

  // User name
  ctx.fillStyle = "#1e3a5f";
  ctx.font = "bold 44px serif";
  ctx.fillText(data.userName, width / 2, 415);

  // Underline for name
  const nameWidth = ctx.measureText(data.userName).width;
  ctx.strokeStyle = "#2d7a5f";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(width / 2 - nameWidth / 2, 430);
  ctx.lineTo(width / 2 + nameWidth / 2, 430);
  ctx.stroke();

  // Completion text (neutral default, no gender markers)
  ctx.fillStyle = "#666";
  ctx.font = "20px sans-serif";
  ctx.fillText("concluiu com êxito o curso", width / 2, 476);

  // Module name — with word wrap
  ctx.fillStyle = "#2d7a5f";
  ctx.font = "bold 28px serif";
  const maxWidth = width - 240;
  const words = data.moduleName.split(" ");
  let line = "";
  let y = 530;
  for (const word of words) {
    const testLine = line + word + " ";
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxWidth && line !== "") {
      ctx.fillText(line.trim(), width / 2, y);
      line = word + " ";
      y += 42;
    } else {
      line = testLine;
    }
  }
  ctx.fillText(line.trim(), width / 2, y);

  // Custom body text (optional extra note from module config)
  if (data.certBody?.trim()) {
    ctx.fillStyle = "#555";
    ctx.font = "italic 17px sans-serif";
    const bodyLines = data.certBody.trim().split("\n");
    for (const bl of bodyLines) {
      y += 38;
      ctx.fillText(bl.trim(), width / 2, y);
    }
  }

  // Date
  const dateStr = data.completedAt.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  ctx.fillStyle = "#888";
  ctx.font = "18px sans-serif";
  ctx.fillText(`Concluído em ${dateStr}`, width / 2, y + 72);

  // Signer info (if configured)
  if (data.certSignerName?.trim()) {
    const signerY = y + 110;
    ctx.strokeStyle = "#aaa";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(width / 2 - 120, signerY - 8);
    ctx.lineTo(width / 2 + 120, signerY - 8);
    ctx.stroke();
    ctx.fillStyle = "#444";
    ctx.font = "bold 16px sans-serif";
    ctx.fillText(data.certSignerName.trim(), width / 2, signerY + 10);
    if (data.certSignerRole?.trim()) {
      ctx.fillStyle = "#777";
      ctx.font = "14px sans-serif";
      ctx.fillText(data.certSignerRole.trim(), width / 2, signerY + 28);
    }
  }

  // Footer divider
  ctx.strokeStyle = "#1e3a5f";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(120, height - 110);
  ctx.lineTo(width - 120, height - 110);
  ctx.stroke();

  // Certificate code
  ctx.fillStyle = "#bbb";
  ctx.font = "13px monospace";
  ctx.fillText(`Código de Verificação: ${data.certificateCode}`, width / 2, height - 80);

  // QR code linking to public verification page (bottom-right)
  try {
    const verifyUrl = `https://saudedotrabalho.com/verificar/${data.certificateCode}`;
    const qrDataUrl = await QRCode.toDataURL(verifyUrl, {
      width: 120,
      margin: 1,
      color: { dark: "#1e3a5f", light: "#ffffff" },
    });
    const qrImg = await loadImage(qrDataUrl);
    const qrSize = 120;
    const qrX = width - qrSize - 70;
    const qrY = height - qrSize - 130;
    ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize);
    ctx.fillStyle = "#888";
    ctx.font = "10px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Verifique a autenticidade", qrX + qrSize / 2, qrY + qrSize + 14);
  } catch (e) {
    console.warn("[certificate] QR code generation failed:", e);
  }

  // Return as PNG buffer
  return canvas.toBuffer("image/png");
}

