'use strict';

const router = require('express').Router();
const { query, queryOne } = require('../config/db');
const { requireLogin } = require('../middleware/auth');
const { logAudit } = require('../utils/auditLogger');
const { pushNotification } = require('../utils/notifications');

async function nextDocNo() {
  const row = await queryOne("SELECT doc_no FROM documents WHERE doc_no LIKE 'DOC-%' ORDER BY id DESC LIMIT 1");
  if (!row || !row.doc_no) return 'DOC-001';
  const num = parseInt(row.doc_no.split('-')[1], 10) + 1;
  return `DOC-${String(num).padStart(3, '0')}`;
}

router.get('/api/documents/list', requireLogin, async (req, res, next) => {
  try {
    const documents = await query('SELECT * FROM documents ORDER BY id DESC');
    res.json({ success: true, documents });
  } catch (err) { next(err); }
});

router.get('/api/documents/get/:id', requireLogin, async (req, res, next) => {
  try {
    const document = await queryOne('SELECT * FROM documents WHERE id=$1', [req.params.id]);
    if (!document) return res.status(404).json({ success: false, error: 'Document not found' });
    res.json({ success: true, document });
  } catch (err) { next(err); }
});

router.post('/api/documents/add', requireLogin, async (req, res, next) => {
  try {
    const doc_no = await nextDocNo();
    const {
      title, doc_type = 'General', related_to, uploaded_by,
      file_path, status = 'Active', expiry_date, notes,
    } = req.body;
    const rows = await query(
      `INSERT INTO documents
        (doc_no, title, doc_type, related_to, uploaded_by, file_path, status, expiry_date, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [doc_no, title, doc_type, related_to, uploaded_by, file_path, status, expiry_date, notes]
    );
    const document = rows[0];
    await logAudit('Created Document', 'Documents', req.session.user.email, `Document ${doc_no}: ${title}`, req.ip);
    await pushNotification('Document Uploaded', `Document ${doc_no} — ${title} uploaded`, 'info', 'all');
    res.json({ success: true, document });
  } catch (err) { next(err); }
});

router.post('/api/documents/update/:id', requireLogin, async (req, res, next) => {
  try {
    const existing = await queryOne('SELECT * FROM documents WHERE id=$1', [req.params.id]);
    if (!existing) return res.status(404).json({ success: false, error: 'Document not found' });
    const m = { ...existing, ...req.body };
    await query(
      `UPDATE documents SET title=$1, doc_type=$2, related_to=$3, uploaded_by=$4,
       file_path=$5, status=$6, expiry_date=$7, notes=$8 WHERE id=$9`,
      [m.title, m.doc_type, m.related_to, m.uploaded_by,
       m.file_path, m.status, m.expiry_date, m.notes, req.params.id]
    );
    const updated = await queryOne('SELECT * FROM documents WHERE id=$1', [req.params.id]);
    await logAudit('Updated Document', 'Documents', req.session.user.email, `Document ${existing.doc_no} updated`, req.ip);
    res.json({ success: true, document: updated });
  } catch (err) { next(err); }
});

router.post('/api/documents/delete/:id', requireLogin, async (req, res, next) => {
  try {
    const document = await queryOne('SELECT * FROM documents WHERE id=$1', [req.params.id]);
    if (!document) return res.status(404).json({ success: false, error: 'Document not found' });
    await query('DELETE FROM documents WHERE id=$1', [req.params.id]);
    await logAudit('Deleted Document', 'Documents', req.session.user.email, `Document ${document.doc_no} deleted`, req.ip);
    await pushNotification('Document Deleted', `Document ${document.doc_no} deleted`, 'warning', 'all');
    res.json({ success: true });
  } catch (err) { next(err); }
});

module.exports = router;
