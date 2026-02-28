import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

export const generateKYCReport = (data: {
  userName: string;
  date: string;
  status: string;
  confidenceScore: number;
  riskScore: number;
  explanation: string;
  aadhaarDetails?: any;
  faceDetails?: any;
  voiceDetails?: any;
}) => {
  const doc = new jsPDF();
  const primaryColor = [16, 185, 129]; // Emerald 500

  // Header
  doc.setFillColor(20, 20, 20);
  doc.rect(0, 0, 210, 40, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.text('KYC BUSTER', 20, 25);
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('OFFICIAL VERIFICATION REPORT', 20, 32);
  
  doc.setFontSize(8);
  doc.text(`Report ID: KYC-${Math.random().toString(36).substr(2, 9).toUpperCase()}`, 150, 25);
  doc.text(`Generated: ${new Date().toLocaleString()}`, 150, 30);

  // Main Status
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(14);
  doc.text('Verification Summary', 20, 55);
  
  const statusColor = data.status === 'verified' ? [16, 185, 129] : [239, 68, 68];
  doc.setDrawColor(statusColor[0], statusColor[1], statusColor[2]);
  doc.setLineWidth(1);
  doc.line(20, 58, 190, 58);

  // Summary Table
  (doc as any).autoTable({
    startY: 65,
    head: [['Field', 'Value']],
    body: [
      ['User Name', data.userName],
      ['Verification Date', data.date],
      ['Final Decision', data.status.toUpperCase()],
      ['Confidence Score', `${data.confidenceScore}%`],
      ['Risk Level', `${data.riskScore}/100`],
    ],
    theme: 'striped',
    headStyles: { fillColor: primaryColor },
  });

  // AI Explanation
  const finalY = (doc as any).lastAutoTable.finalY + 15;
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('AI Decision Reasoning', 20, finalY);
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  const splitExplanation = doc.splitTextToSize(data.explanation, 170);
  doc.text(splitExplanation, 20, finalY + 7);

  // Detailed Analysis
  const detailY = finalY + (splitExplanation.length * 5) + 15;
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Component Analysis', 20, detailY);

  const componentBody = [];
  if (data.aadhaarDetails) componentBody.push(['Aadhaar OCR', 'Verified', data.aadhaarDetails.confidence + '%']);
  if (data.faceDetails) componentBody.push(['Face Liveness', 'Verified', data.faceDetails.confidence + '%']);
  if (data.voiceDetails) componentBody.push(['Voice Auth', 'Verified', data.voiceDetails.riskLevel + ' Risk']);

  (doc as any).autoTable({
    startY: detailY + 5,
    head: [['Component', 'Status', 'Metric']],
    body: componentBody,
    theme: 'grid',
    headStyles: { fillColor: [60, 60, 60] },
  });

  // Footer
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text('This report is electronically generated and verified by Deepfake KYC Buster AI Engine.', 20, 285);
    doc.text(`Page ${i} of ${pageCount}`, 180, 285);
  }

  doc.save(`KYC_Report_${data.userName.replace(/\s+/g, '_')}.pdf`);
};
