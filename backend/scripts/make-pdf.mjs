/**
 * Builds a tiny but valid text-based PDF so the upload -> extract -> AI ->
 * publish path can be exercised exactly like the demo does.
 */
import { writeFileSync } from 'node:fs';

const LINES = [
  'Database Management Systems - Unit 1',
  '',
  'A database is an organised collection of structured data that can be',
  'accessed, managed and updated electronically.',
  '',
  'SQL stands for Structured Query Language. It is the standard language',
  'used to create, read, update and delete data in a relational database.',
  '',
  'A primary key uniquely identifies each row in a table. It cannot be null',
  'and must be unique across all rows.',
  '',
  'A foreign key is a column that references the primary key of another',
  'table, creating a link between the two tables. This is how relationships',
  'are represented in a relational model.',
  '',
  'Normalisation is the process of organising data to reduce redundancy and',
  'improve data integrity. First Normal Form removes repeating groups.',
  'Second Normal Form removes partial dependencies. Third Normal Form',
  'removes transitive dependencies.',
  '',
  'A transaction is a sequence of operations performed as a single logical',
  'unit of work. Transactions follow the ACID properties: Atomicity,',
  'Consistency, Isolation and Durability.',
  '',
  'An index is a data structure that improves the speed of data retrieval',
  'operations at the cost of additional writes and storage space.',
  '',
  'A JOIN clause combines rows from two or more tables based on a related',
  'column. INNER JOIN returns only matching rows, while LEFT JOIN returns',
  'all rows from the left table plus matching rows from the right.',
  '',
  'NoSQL databases such as MongoDB store documents rather than tables and',
  'are designed for flexible schemas and horizontal scaling.',
];

function escapeText(text) {
  return text.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

// Build the content stream: 12pt Helvetica, 16pt leading, starting near the top.
let content = 'BT\n/F1 12 Tf\n16 TL\n56 760 Td\n';
for (const line of LINES) {
  content += `(${escapeText(line)}) Tj\nT*\n`;
}
content += 'ET\n';

const objects = [
  '<< /Type /Catalog /Pages 2 0 R >>',
  '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
  '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',
  `<< /Length ${Buffer.byteLength(content, 'latin1')} >>\nstream\n${content}endstream`,
  '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
];

let pdf = '%PDF-1.4\n';
const offsets = [];
objects.forEach((body, index) => {
  offsets.push(Buffer.byteLength(pdf, 'latin1'));
  pdf += `${index + 1} 0 obj\n${body}\nendobj\n`;
});

const xrefOffset = Buffer.byteLength(pdf, 'latin1');
pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
for (const offset of offsets) {
  pdf += `${String(offset).padStart(10, '0')} 00000 n \n`;
}
pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

const target = new URL('../fixtures/dbms-unit-1.pdf', import.meta.url);
const { mkdirSync } = await import('node:fs');
mkdirSync(new URL('../fixtures/', import.meta.url), { recursive: true });
writeFileSync(target, Buffer.from(pdf, 'latin1'));
console.log(`wrote ${target.pathname} (${Buffer.byteLength(pdf, 'latin1')} bytes)`);
