import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import type { Note } from '../types';
import { getChecklistProgress } from './markdownChecklist';

export interface ProjectReportSummary {
  totalNotes: number;
  totalChecklistItems: number;
  checkedChecklistItems: number;
}

export const computeProjectReportSummary = (notes: Note[]): ProjectReportSummary => {
  let totalChecklistItems = 0;
  let checkedChecklistItems = 0;
  notes.forEach((note) => {
    const progress = getChecklistProgress(note.contentMarkdown);
    if (progress) {
      totalChecklistItems += progress.total;
      checkedChecklistItems += progress.checked;
    }
  });
  return { totalNotes: notes.length, totalChecklistItems, checkedChecklistItems };
};

export const buildCloseOutReportDoc = (projectName: string, notes: Note[]): jsPDF => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const summary = computeProjectReportSummary(notes);

  doc.setFontSize(9);
  doc.setTextColor(140);
  doc.text('NoteDoco', 14, 15);
  doc.text('Project Close-Out Report', pageWidth - 14, 15, { align: 'right' });

  let y = 26;
  doc.setFontSize(10);
  doc.setTextColor(60);
  const metaLine = (label: string, value: string) => {
    doc.setFont('helvetica', 'bold');
    doc.text(label, 14, y);
    doc.setFont('helvetica', 'normal');
    doc.text(value, 45, y);
    y += 6;
  };
  metaLine('Project:', projectName);
  metaLine('Generated:', format(new Date(), "MMM d, yyyy 'at' HH:mm"));
  metaLine('Notes:', String(summary.totalNotes));
  metaLine(
    'Checklist items:',
    summary.totalChecklistItems > 0 ? `${summary.checkedChecklistItems}/${summary.totalChecklistItems} complete` : 'None'
  );

  y += 4;
  doc.setFontSize(12);
  doc.setTextColor(20);
  doc.setFont('helvetica', 'bold');
  doc.text('Notes', 14, y);

  const rows = notes.map((note) => {
    const progress = getChecklistProgress(note.contentMarkdown);
    return [note.title || 'Untitled note', note.goalDate ?? '-', progress ? `${progress.checked}/${progress.total}` : '-'];
  });

  autoTable(doc, {
    startY: y + 4,
    head: [['Title', 'Goal Date', 'Checklist']],
    body: rows.length > 0 ? rows : [['No notes in this project', '-', '-']],
    headStyles: { fillColor: [38, 49, 58] },
    styles: { fontSize: 9 },
  });

  return doc;
};

const slugify = (name: string): string =>
  name
    .replace(/[^a-z0-9]+/gi, '-')
    .toLowerCase()
    .replace(/^-+|-+$/g, '') || 'project';

export const downloadCloseOutReport = (projectName: string, notes: Note[]): void => {
  const doc = buildCloseOutReportDoc(projectName, notes);
  doc.save(`${slugify(projectName)}-close-out-report.pdf`);
};
