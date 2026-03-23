'use strict';

const router = require('express').Router();
const { query, queryOne } = require('../config/db');
const { requireLogin } = require('../middleware/auth');
const { logAudit } = require('../utils/auditLogger');
const { pushNotification } = require('../utils/notifications');

router.get('/api/tasks/list', requireLogin, async (req, res, next) => {
  try {
    const tasks = await query(
      `SELECT * FROM tasks ORDER BY
        CASE status WHEN 'Pending' THEN 1 WHEN 'In Progress' THEN 2 ELSE 3 END, due_date ASC`
    );
    res.json({ success: true, tasks });
  } catch (err) { next(err); }
});

router.get('/api/tasks/get/:id', requireLogin, async (req, res, next) => {
  try {
    const task = await queryOne('SELECT * FROM tasks WHERE id=$1', [req.params.id]);
    if (!task) return res.status(404).json({ success: false, error: 'Task not found' });
    res.json({ success: true, task });
  } catch (err) { next(err); }
});

router.post('/api/tasks/add', requireLogin, async (req, res, next) => {
  try {
    const { task, related_to, assigned_to, priority = 'Medium', due_date, status = 'Pending', notes } = req.body;
    const rows = await query(
      `INSERT INTO tasks (task, related_to, assigned_to, priority, due_date, status, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [task, related_to, assigned_to, priority, due_date, status, notes]
    );
    const newTask = rows[0];
    await logAudit('Created Task', 'Tasks', req.session.user.email, `Task created: ${task}`, req.ip);
    await pushNotification('New Task', `Task assigned to ${assigned_to}: ${task}`, 'info', 'all');
    res.json({ success: true, task: newTask });
  } catch (err) { next(err); }
});

router.post('/api/tasks/update/:id', requireLogin, async (req, res, next) => {
  try {
    const existing = await queryOne('SELECT * FROM tasks WHERE id=$1', [req.params.id]);
    if (!existing) return res.status(404).json({ success: false, error: 'Task not found' });
    const m = { ...existing, ...req.body };
    await query(
      `UPDATE tasks SET task=$1, related_to=$2, assigned_to=$3, priority=$4, due_date=$5, status=$6, notes=$7 WHERE id=$8`,
      [m.task, m.related_to, m.assigned_to, m.priority, m.due_date, m.status, m.notes, req.params.id]
    );
    const updated = await queryOne('SELECT * FROM tasks WHERE id=$1', [req.params.id]);
    await logAudit('Updated Task', 'Tasks', req.session.user.email, `Task #${req.params.id} updated`, req.ip);
    res.json({ success: true, task: updated });
  } catch (err) { next(err); }
});

router.post('/api/tasks/complete/:id', requireLogin, async (req, res, next) => {
  try {
    const task = await queryOne('SELECT * FROM tasks WHERE id=$1', [req.params.id]);
    if (!task) return res.status(404).json({ success: false, error: 'Task not found' });
    await query('UPDATE tasks SET status=$1 WHERE id=$2', ['Done', req.params.id]);
    await logAudit('Completed Task', 'Tasks', req.session.user.email, `Task #${req.params.id} marked Done`, req.ip);
    res.json({ success: true });
  } catch (err) { next(err); }
});

router.post('/api/tasks/delete/:id', requireLogin, async (req, res, next) => {
  try {
    const task = await queryOne('SELECT * FROM tasks WHERE id=$1', [req.params.id]);
    if (!task) return res.status(404).json({ success: false, error: 'Task not found' });
    await query('DELETE FROM tasks WHERE id=$1', [req.params.id]);
    await logAudit('Deleted Task', 'Tasks', req.session.user.email, `Task #${req.params.id} deleted`, req.ip);
    res.json({ success: true });
  } catch (err) { next(err); }
});

module.exports = router;
