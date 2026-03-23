'use strict';

require('dotenv').config();
const { pool, query } = require('./src/config/db');
const { hashPassword } = require('./src/utils/passwordHelper');

async function seed() {
  console.log('\n  Seeding SST ERP database...\n');

  // ── 1. USERS ──
  console.log('  [1/9] Users...');
  const users = [
    ['Gajendra SR',   'admin@ssttours.com',   'admin123',   'admin',   'Management'],
    ['Kiran Mohan',   'kiran@ssttours.com',   'kiran@123',  'manager', 'Operations'],
    ['Divya Ramesh',  'divya@ssttours.com',   'divya@123',  'manager', 'Sales'],
    ['Suresh Kumar',  'suresh@ssttours.com',  'suresh@123', 'manager', 'Finance'],
    ['Meena Iyer',    'meena@ssttours.com',   'meena@123',  'manager', 'HR'],
    ['Ravi Shankar',  'ravi@ssttours.com',    'ravi@123',   'staff',   'Sales'],
    ['Priya Nair',    'priya@ssttours.com',   'priya@123',  'staff',   'Sales'],
    ['Arun Das',      'arun@ssttours.com',    'arun@123',   'staff',   'Operations'],
    ['Sneha Patil',   'sneha@ssttours.com',   'sneha@123',  'staff',   'Visa'],
    ['Vikram Joshi',  'vikram@ssttours.com',  'vikram@123', 'staff',   'Finance'],
    ['Lakshmi Rao',   'lakshmi@ssttours.com', 'lakshmi@123','staff',   'Operations'],
    ['Deepak Reddy',  'deepak@ssttours.com',  'deepak@123', 'staff',   'Sales'],
  ];
  for (const [name, email, pwd, role, dept] of users) {
    const exists = await pool.query('SELECT id FROM users WHERE email=$1', [email]);
    if (exists.rows.length === 0) {
      const hashed = await hashPassword(pwd);
      await pool.query(
        'INSERT INTO users (name, email, password, role, department, status) VALUES ($1,$2,$3,$4,$5,$6)',
        [name, email, hashed, role, dept, 'active']
      );
    }
  }
  console.log('    Done.');

  // ── 2. EMPLOYEES ──
  console.log('  [2/9] Employees...');
  const employees = [
    ['EMP-001', 'Gajendra SR',    'Director / CEO',            'Management',  '9876543210', 'gajendra@ssttours.com', '2018-01-15', 'Active'],
    ['EMP-002', 'Kiran Mohan',    'HOD - Operations',          'Operations',  '9876543211', 'kiran@ssttours.com',    '2018-03-01', 'Active'],
    ['EMP-003', 'Divya Ramesh',   'HOD - Sales',               'Sales',       '9876543212', 'divya@ssttours.com',    '2018-06-10', 'Active'],
    ['EMP-004', 'Suresh Kumar',   'HOD - Finance',             'Finance',     '9876543213', 'suresh@ssttours.com',   '2019-01-05', 'Active'],
    ['EMP-005', 'Meena Iyer',     'HR Manager',                'HR',          '9876543214', 'meena@ssttours.com',    '2019-04-20', 'Active'],
    ['EMP-006', 'Ravi Shankar',   'Senior Travel Consultant',  'Sales',       '9876543215', 'ravi@ssttours.com',     '2020-02-15', 'Active'],
    ['EMP-007', 'Priya Nair',     'Travel Consultant',         'Sales',       '9876543216', 'priya@ssttours.com',    '2020-08-01', 'Active'],
    ['EMP-008', 'Arun Das',       'Operations Executive',      'Operations',  '9876543217', 'arun@ssttours.com',     '2021-01-10', 'Active'],
    ['EMP-009', 'Sneha Patil',    'Visa Executive',            'Visa',        '9876543218', 'sneha@ssttours.com',    '2021-06-15', 'Active'],
    ['EMP-010', 'Vikram Joshi',   'Accounts Executive',        'Finance',     '9876543219', 'vikram@ssttours.com',   '2022-02-01', 'Active'],
    ['EMP-011', 'Lakshmi Rao',    'Tour Coordinator',          'Operations',  '9876543220', 'lakshmi@ssttours.com',  '2022-07-20', 'Active'],
    ['EMP-012', 'Deepak Reddy',   'Travel Consultant',         'Sales',       '9876543221', 'deepak@ssttours.com',   '2023-01-10', 'On Leave'],
    ['EMP-013', 'Anitha Sharma',  'Front Desk Executive',      'Sales',       '9876543222', 'anitha@ssttours.com',   '2023-06-01', 'Active'],
    ['EMP-014', 'Rajesh Hegde',   'Driver / Logistics',        'Operations',  '9876543223', 'rajesh@ssttours.com',   '2024-01-15', 'Active'],
    ['EMP-015', 'Pooja Shetty',   'Digital Marketing Executive','Marketing',  '9876543224', 'pooja@ssttours.com',    '2024-06-01', 'Active'],
  ];
  for (const [emp_no, name, designation, department, phone, email, date_of_join, status] of employees) {
    const exists = await pool.query('SELECT id FROM employees WHERE emp_no=$1', [emp_no]);
    if (exists.rows.length === 0) {
      await pool.query(
        'INSERT INTO employees (emp_no, name, designation, department, phone, email, date_of_join, status) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',
        [emp_no, name, designation, department, phone, email, date_of_join, status]
      );
    }
  }
  console.log('    Done.');

  // ── 3. LEADS ──
  console.log('  [3/9] Leads...');
  const leads = [
    ['L-001', 'Patel Family',    '9845012345', 'Kedarnath 5N7D',             4, 120000, 'WhatsApp',   'Divya Ramesh',  'New Enquiry',     'Hot',  '2026-03-18', '2026-05-15', 'Wants Kedarnath-Badrinath combo. Budget flexible for helicopter add-on.'],
    ['L-002', 'Sharma Couple',   '9845012346', 'Maldives 5N6D',              2, 250000, 'Website',    'Ravi Shankar',  'Quotation Sent',  'Warm', '2026-03-20', '2026-04-20', 'Anniversary trip. Interested in water villa. Comparing with SOTC.'],
    ['L-003', 'Mehta Group',     '9845012347', 'Goa 4N5D',                   8,  80000, 'Referral',   'Priya Nair',    'Follow-Up',       'Warm', '2026-03-19', '2026-04-05', 'College friends reunion. Need villa with pool. Budget-conscious.'],
    ['L-004', 'Gupta Family',    '9845012348', 'Bangkok-Pattaya 6N7D',       5, 350000, 'WhatsApp',   'Divya Ramesh',  'Quotation Sent',  'Hot',  '2026-03-17', '2026-04-10', 'First international trip. Need visa assistance. Prefer Hindi-speaking guide.'],
    ['L-005', 'Singh Family',    '9845012349', 'Dubai 5N6D',                 6, 500000, 'Instagram',  'Ravi Shankar',  'Advance Paid',    'Hot',  '2026-03-16', '2026-04-01', 'Premium package — Burj Khalifa, Desert Safari, Dhow Cruise included.'],
    ['L-006', 'Reddy Corporate', '9845012350', 'Munnar-Thekkady 4N5D',      20, 300000, 'Google Ads', 'Priya Nair',    'New Enquiry',     'Warm', '2026-03-22', '2026-05-01', 'Corporate offsite for IT company. Need conference hall + team activities.'],
    ['L-007', 'Deshmukh Family', '9845012351', 'Singapore-Malaysia 7N8D',    4, 400000, 'WhatsApp',   'Ravi Shankar',  'Quotation Sent',  'Hot',  '2026-03-18', '2026-04-25', 'Family with 2 kids. Want Universal Studios & Legoland included.'],
    ['L-008', 'Naidu Couple',    '9845012352', 'Bali 6N7D',                  2, 180000, 'Referral',   'Divya Ramesh',  'Follow-Up',       'Cold', '2026-03-25', '2026-06-10', 'Honeymoon trip. Will confirm after March end.'],
    ['L-009', 'Khan Family',     '9845012353', 'Kashmir 5N6D',               6, 150000, 'Walk-in',    'Priya Nair',    'New Enquiry',     'Warm', '2026-03-19', '2026-04-15', 'Srinagar-Pahalgam-Gulmarg circuit. Need houseboat stay.'],
    ['L-010', 'Agarwal Group',   '9845012354', 'Europe 10N12D',              8,1200000, 'WhatsApp',   'Divya Ramesh',  'Quotation Sent',  'Hot',  '2026-03-17', '2026-06-01', 'Multi-country: France-Switzerland-Italy. Premium hotels only.'],
    ['L-011', 'Jain Family',     '9845012355', 'Manali-Shimla 5N6D',         5, 100000, 'Google Ads', 'Ravi Shankar',  'New Enquiry',     'Warm', '2026-03-20', '2026-05-20', 'Summer holiday with kids. Want Rohtang Pass and Solang Valley.'],
    ['L-012', 'Bhat Couple',     '9845012356', 'Sri Lanka 5N6D',             2, 160000, 'Instagram',  'Priya Nair',    'Follow-Up',       'Warm', '2026-03-21', '2026-04-28', 'Beach + heritage combo. Interested in Sigiriya & Kandy.'],
    ['L-013', 'Rao Corporate',   '9845012357', 'Jim Corbett 3N4D',          15, 225000, 'Referral',   'Divya Ramesh',  'Advance Paid',    'Hot',  '2026-03-16', '2026-03-28', 'Wildlife safari trip for startup team. Need jungle lodge.'],
    ['L-014', 'Pillai Family',   '9845012358', 'Andaman 6N7D',               4, 200000, 'Website',    'Ravi Shankar',  'Quotation Sent',  'Warm', '2026-03-22', '2026-05-05', 'Scuba diving + Havelock Island. Need ferry booking.'],
    ['L-015', 'Chopra Family',   '9845012359', 'Thailand+Vietnam 10N12D',    3, 450000, 'WhatsApp',   'Divya Ramesh',  'New Enquiry',     'Hot',  '2026-03-18', '2026-05-10', 'Southeast Asia circuit. Premium traveller. 5-star only.'],
  ];
  for (const [lead_no, client_name, phone, destination, pax, budget, source, assigned_to, stage, temperature, follow_up_date, travel_date, notes] of leads) {
    const exists = await pool.query('SELECT id FROM leads WHERE lead_no=$1', [lead_no]);
    if (exists.rows.length === 0) {
      await pool.query(
        'INSERT INTO leads (lead_no, client_name, phone, destination, pax, budget, source, assigned_to, stage, temperature, follow_up_date, travel_date, notes) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)',
        [lead_no, client_name, phone, destination, pax, budget, source, assigned_to, stage, temperature, follow_up_date, travel_date, notes]
      );
    }
  }
  console.log('    Done.');

  // ── 4. QUOTATIONS ──
  console.log('  [4/9] Quotations...');
  const quotations = [
    ['Q-2026-001', 'Sharma Couple',    'Maldives 5N6D',              2, '5 Nights / 6 Days',   245000, 'Ravi Shankar',  '2026-03-10', '2026-03-25', 'Awaiting'],
    ['Q-2026-002', 'Gupta Family',     'Bangkok-Pattaya 6N7D',       5, '6 Nights / 7 Days',   340000, 'Divya Ramesh',  '2026-03-08', '2026-03-23', 'Awaiting'],
    ['Q-2026-003', 'Singh Family',     'Dubai 5N6D',                 6, '5 Nights / 6 Days',   480000, 'Ravi Shankar',  '2026-03-05', '2026-03-20', 'Accepted'],
    ['Q-2026-004', 'Deshmukh Family',  'Singapore-Malaysia 7N8D',    4, '7 Nights / 8 Days',   390000, 'Ravi Shankar',  '2026-03-12', '2026-03-27', 'Awaiting'],
    ['Q-2026-005', 'Agarwal Group',    'Europe 10N12D',              8, '10 Nights / 12 Days',1150000, 'Divya Ramesh',  '2026-03-11', '2026-03-26', 'Awaiting'],
    ['Q-2026-006', 'Patel Family',     'Kedarnath 5N7D',             4, '5 Nights / 7 Days',   115000, 'Divya Ramesh',  '2026-03-14', '2026-03-29', 'Revision'],
    ['Q-2026-007', 'Rao Corporate',    'Jim Corbett 3N4D',          15, '3 Nights / 4 Days',   220000, 'Divya Ramesh',  '2026-03-06', '2026-03-21', 'Accepted'],
    ['Q-2026-008', 'Pillai Family',    'Andaman 6N7D',               4, '6 Nights / 7 Days',   195000, 'Ravi Shankar',  '2026-03-13', '2026-03-28', 'Awaiting'],
    ['Q-2026-009', 'Reddy Corporate',  'Munnar-Thekkady 4N5D',      20, '4 Nights / 5 Days',   290000, 'Priya Nair',    '2026-03-15', '2026-03-30', 'Awaiting'],
    ['Q-2026-010', 'Chopra Family',    'Thailand+Vietnam 10N12D',    3, '10 Nights / 12 Days',  430000, 'Divya Ramesh',  '2026-03-16', '2026-03-31', 'Awaiting'],
    ['Q-2026-011', 'Mehta Group',      'Goa 4N5D',                   8, '4 Nights / 5 Days',    76000, 'Priya Nair',    '2026-03-01', '2026-03-16', 'Rejected'],
    ['Q-2026-012', 'Bhat Couple',      'Sri Lanka 5N6D',             2, '5 Nights / 6 Days',   155000, 'Priya Nair',    '2026-03-14', '2026-03-29', 'Awaiting'],
  ];
  for (const [quote_no, client, destination, pax, duration, amount, prepared_by, date_sent, valid_until, status] of quotations) {
    const exists = await pool.query('SELECT id FROM quotations WHERE quote_no=$1', [quote_no]);
    if (exists.rows.length === 0) {
      await pool.query(
        'INSERT INTO quotations (quote_no, client, destination, pax, duration, amount, prepared_by, date_sent, valid_until, status) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',
        [quote_no, client, destination, pax, duration, amount, prepared_by, date_sent, valid_until, status]
      );
    }
  }
  console.log('    Done.');

  // ── 5. BOOKINGS ──
  console.log('  [5/9] Bookings...');
  const bookings = [
    ['BK-2026-001', 'Singh Family',       '9845012349', 'Dubai 5N6D',              'FIT',  6, '2026-04-01', '2026-04-06', 'Ravi Shankar',  480000, 200000, 'Bank Transfer', 'Confirmed'],
    ['BK-2026-002', 'Rao Corporate',      '9845012357', 'Jim Corbett 3N4D',        'GIT', 15, '2026-03-28', '2026-03-31', 'Divya Ramesh',  220000, 110000, 'Cheque',        'Confirmed'],
    ['BK-2026-003', 'Joshi Family',       '9845012360', 'Rajasthan 6N7D',          'FIT',  4, '2026-04-05', '2026-04-11', 'Priya Nair',    140000,  70000, 'UPI',           'Confirmed'],
    ['BK-2026-004', 'Verma Family',       '9845012361', 'Kerala 7N8D',             'FIT',  3, '2026-04-10', '2026-04-17', 'Ravi Shankar',  165000,  50000, 'UPI',           'Confirmed'],
    ['BK-2026-005', 'Das Couple',         '9845012362', 'Andaman 5N6D',            'FIT',  2, '2026-04-15', '2026-04-20', 'Divya Ramesh',  130000,  40000, 'Bank Transfer', 'Confirmed'],
    ['BK-2026-006', 'Iyer Group',         '9845012363', 'Goa 4N5D',                'GIT', 10, '2026-03-25', '2026-03-29', 'Priya Nair',     95000,  95000, 'UPI',           'Confirmed'],
    ['BK-2026-007', 'Nair Family',        '9845012364', 'Ooty-Kodaikanal 4N5D',    'FIT',  5, '2026-04-08', '2026-04-12', 'Ravi Shankar',   85000,  42500, 'Cash',          'Confirmed'],
    ['BK-2026-008', 'Srinivas Family',    '9845012365', 'Coorg 3N4D',              'FIT',  4, '2026-03-22', '2026-03-25', 'Priya Nair',     60000,  60000, 'UPI',           'Confirmed'],
    ['BK-2026-009', 'Kulkarni Corporate', '9845012366', 'Pondicherry 2N3D',        'GIT', 12, '2026-03-20', '2026-03-22', 'Divya Ramesh',  108000, 108000, 'Cheque',        'Confirmed'],
    ['BK-2026-010', 'Hegde Family',       '9845012367', 'Ladakh 7N8D',             'FIT',  3, '2026-05-01', '2026-05-08', 'Ravi Shankar',  195000,  80000, 'Bank Transfer', 'Confirmed'],
    ['BK-2026-011', 'Murthy Couple',      '9845012368', 'Vietnam 6N7D',            'FIT',  2, '2026-04-20', '2026-04-26', 'Divya Ramesh',  210000, 100000, 'Bank Transfer', 'Confirmed'],
    ['BK-2026-012', 'Prasad Family',      '9845012369', 'Varanasi-Prayagraj 4N5D', 'FIT',  6, '2026-04-12', '2026-04-16', 'Priya Nair',     90000,  45000, 'UPI',           'Confirmed'],
  ];
  for (const [booking_no, client, phone, destination, tour_type, pax, depart_date, return_date, sales_person, package_amount, advance_paid, payment_mode, status] of bookings) {
    const exists = await pool.query('SELECT id FROM bookings WHERE booking_no=$1', [booking_no]);
    if (exists.rows.length === 0) {
      await pool.query(
        'INSERT INTO bookings (booking_no, client, phone, destination, tour_type, pax, depart_date, return_date, sales_person, package_amount, advance_paid, payment_mode, status) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)',
        [booking_no, client, phone, destination, tour_type, pax, depart_date, return_date, sales_person, package_amount, advance_paid, payment_mode, status]
      );
    }
  }
  console.log('    Done.');

  // ── 6. TASKS ──
  console.log('  [6/9] Tasks...');
  const tasks = [
    ['Confirm hotel vouchers for Singh Family Dubai trip',       'BK-2026-001', 'Arun Das',      'High',   '2026-03-25', 'Pending',     'JW Marriott, Palm Jumeirah booked. Awaiting confirmation voucher.'],
    ['Arrange Jim Corbett jungle safari permits',               'BK-2026-002', 'Lakshmi Rao',   'High',   '2026-03-22', 'Pending',     '15 pax - need Jhirna zone morning safari. Apply via UTTF portal.'],
    ['Send Goa villa booking confirmation to Iyer Group',       'BK-2026-006', 'Arun Das',      'Medium', '2026-03-20', 'In Progress', 'Villa at Candolim confirmed. Need to share check-in details.'],
    ['Process Gupta Family Thailand visa application',          'L-004',       'Sneha Patil',   'High',   '2026-03-18', 'Pending',     '5 passports received. Photo specs need correction for 2 members.'],
    ['Follow up Sharma Couple Maldives quotation',              'Q-2026-001',  'Ravi Shankar',  'Medium', '2026-03-20', 'Pending',     'Client comparing with SOTC. Offer 5% early bird discount.'],
    ['Prepare Europe itinerary for Agarwal Group',              'Q-2026-005',  'Divya Ramesh',  'High',   '2026-03-19', 'In Progress', 'Paris 3N + Zurich 3N + Rome 4N. Include train tickets & local tours.'],
    ['Collect advance payment from Verma Family',               'BK-2026-004', 'Vikram Joshi',  'High',   '2026-03-21', 'Pending',     'Only 50K paid of 1.65L package. Balance 1.15L due before travel.'],
    ['Book Vistara flights for Nair Family Ooty trip',          'BK-2026-007', 'Arun Das',      'Medium', '2026-03-22', 'Pending',     'BLR to CNN round trip. Check Vistara corporate rates.'],
    ['Generate GST invoice for Kulkarni Corporate',             'BK-2026-009', 'Vikram Joshi',  'Low',    '2026-03-21', 'Done',        'Completed trip. Full payment received. Invoice generated.'],
    ['Update vendor rates for Q2-2026 season',                  'Operations',  'Kiran Mohan',   'Medium', '2026-03-31', 'Pending',     'Get updated rates from all hotel & transport vendors for Apr-Jun.'],
    ['Renew VFS Global contract for visa processing',           'Operations',  'Sneha Patil',   'Low',    '2026-04-15', 'Pending',     'Current contract expires Apr 30. Initiate renewal discussion.'],
    ['Monthly payroll processing for March 2026',               'HR',          'Meena Iyer',    'High',   '2026-03-28', 'Pending',     'Process salaries for 15 employees. Include overtime for Arun & Lakshmi.'],
    ['Prepare quarterly revenue report',                        'Finance',     'Suresh Kumar',  'Medium', '2026-03-31', 'In Progress', 'Q1-2026 revenue report for management review. Include GST summary.'],
    ['Social media campaign for summer packages',               'Marketing',   'Pooja Shetty',  'Medium', '2026-03-25', 'Pending',     'Create Instagram reels + Facebook ads for Kashmir & Ladakh summer packages.'],
    ['Client feedback collection for completed trips',          'Operations',  'Lakshmi Rao',   'Low',    '2026-03-30', 'Pending',     'Send Google Form to Srinivas Family & Kulkarni Corporate.'],
  ];
  const taskCount = await pool.query('SELECT COUNT(*) FROM tasks');
  if (parseInt(taskCount.rows[0].count) === 0) {
    for (const [task, related_to, assigned_to, priority, due_date, status, notes] of tasks) {
      await pool.query(
        'INSERT INTO tasks (task, related_to, assigned_to, priority, due_date, status, notes) VALUES ($1,$2,$3,$4,$5,$6,$7)',
        [task, related_to, assigned_to, priority, due_date, status, notes]
      );
    }
  }
  console.log('    Done.');

  // ── 7. VISA APPLICATIONS ──
  console.log('  [7/9] Visa Applications...');
  const visas = [
    ['V-2026-001', 'Singh Family',     'BK-2026-001', 'UAE',              'Tourist Visa',            6, '2026-03-10', '2026-03-22', 'Sneha Patil', 'In Process',      'Complete'],
    ['V-2026-002', 'Gupta Family',     null,           'Thailand',         'Tourist Visa on Arrival', 5, '2026-03-15', '2026-03-28', 'Sneha Patil', 'Docs Collecting', 'Pending'],
    ['V-2026-003', 'Deshmukh Family',  null,           'Singapore',        'Tourist e-Visa',          4, '2026-03-12', '2026-03-25', 'Sneha Patil', 'Applied',         'Complete'],
    ['V-2026-004', 'Agarwal Group',    null,           'France (Schengen)','Schengen Tourist',        8, '2026-03-11', '2026-04-10', 'Sneha Patil', 'Docs Collecting', 'Partial'],
    ['V-2026-005', 'Murthy Couple',    'BK-2026-011', 'Vietnam',          'Tourist e-Visa',          2, '2026-03-14', '2026-04-05', 'Sneha Patil', 'Applied',         'Complete'],
    ['V-2026-006', 'Hegde Family',     'BK-2026-010', 'India (Ladakh)',   'Inner Line Permit',       3, '2026-03-16', '2026-04-20', 'Arun Das',    'Not Required',    'N/A'],
    ['V-2026-007', 'Chopra Family',    null,           'Thailand+Vietnam', 'Multiple',                3, '2026-03-16', '2026-04-20', 'Sneha Patil', 'Docs Collecting', 'Pending'],
    ['V-2026-008', 'Bhat Couple',      null,           'Sri Lanka',        'ETA',                     2, '2026-03-15', '2026-03-28', 'Sneha Patil', 'Approved',        'Complete'],
  ];
  for (const [visa_no, client, booking_ref, destination, visa_type, pax, applied_on, expected_by, handled_by, status, docs_status] of visas) {
    const exists = await pool.query('SELECT id FROM visa_applications WHERE visa_no=$1', [visa_no]);
    if (exists.rows.length === 0) {
      await pool.query(
        'INSERT INTO visa_applications (visa_no, client, booking_ref, destination, visa_type, pax, applied_on, expected_by, handled_by, status, docs_status) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)',
        [visa_no, client, booking_ref, destination, visa_type, pax, applied_on, expected_by, handled_by, status, docs_status]
      );
    }
  }
  console.log('    Done.');

  // ── 8. INVOICES ──
  console.log('  [8/9] Invoices...');
  const invoices = [
    ['INV-2026-001', 'Singh Family',       480000, 24000,   504000, '2026-03-10', '2026-03-25', 'Partial',  5, 200000, 'BK-2026-001'],
    ['INV-2026-002', 'Rao Corporate',      220000, 39600,   259600, '2026-03-08', '2026-03-22', 'Partial', 18, 110000, 'BK-2026-002'],
    ['INV-2026-003', 'Iyer Group',          95000,  4750,    99750, '2026-03-12', '2026-03-20', 'Paid',     5,  95000, 'BK-2026-006'],
    ['INV-2026-004', 'Joshi Family',       140000,  7000,   147000, '2026-03-13', '2026-03-28', 'Partial',  5,  70000, 'BK-2026-003'],
    ['INV-2026-005', 'Verma Family',       165000,  8250,   173250, '2026-03-14', '2026-03-30', 'Partial',  5,  50000, 'BK-2026-004'],
    ['INV-2026-006', 'Srinivas Family',     60000,  3000,    63000, '2026-03-16', '2026-03-22', 'Paid',     5,  60000, 'BK-2026-008'],
    ['INV-2026-007', 'Kulkarni Corporate', 108000, 19440,   127440, '2026-03-15', '2026-03-20', 'Paid',    18, 108000, 'BK-2026-009'],
    ['INV-2026-008', 'Das Couple',         130000,  6500,   136500, '2026-03-15', '2026-04-01', 'Unpaid',   5,  40000, 'BK-2026-005'],
    ['INV-2026-009', 'Nair Family',         85000,  4250,    89250, '2026-03-16', '2026-03-30', 'Partial',  5,  42500, 'BK-2026-007'],
    ['INV-2026-010', 'Hegde Family',       195000,  9750,   204750, '2026-03-16', '2026-04-15', 'Unpaid',   5,  80000, 'BK-2026-010'],
    ['INV-2026-011', 'Murthy Couple',      210000, 10500,   220500, '2026-03-16', '2026-04-10', 'Partial',  5, 100000, 'BK-2026-011'],
    ['INV-2026-012', 'Prasad Family',       90000,  4500,    94500, '2026-03-16', '2026-04-05', 'Partial',  5,  45000, 'BK-2026-012'],
  ];
  for (const [invoice_no, client, amount, gst_amount, total_amount, invoice_date, due_date, status, gst_rate, paid, booking_ref] of invoices) {
    const exists = await pool.query('SELECT id FROM invoices WHERE invoice_no=$1', [invoice_no]);
    if (exists.rows.length === 0) {
      await pool.query(
        'INSERT INTO invoices (invoice_no, client, amount, gst_amount, invoice_date, due_date, status, gst_rate, paid, booking_ref) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',
        [invoice_no, client, amount, gst_amount, invoice_date, due_date, status, gst_rate, paid, booking_ref]
      );
    }
  }
  console.log('    Done.');

  // ── 9. VENDORS ──
  console.log('  [9/9] Vendors...');
  const vendors = [
    ['Sea Face Hotels',         'Hotel',     'Goa',               4, '8322456789', 'bookings@seafacehotels.com'],
    ['Rajwada Palace',          'Hotel',     'Jaipur',            5, '1412345678', 'reservations@rajwadapalace.in'],
    ['Speedy Cabs',             'Transport', 'Bangalore',         4, '8043210987', 'fleet@speedycabs.in'],
    ['IndiGo Corporate',        'Airline',   'All Routes',        3, '1244567890', 'corporate@goindigo.in'],
    ['VFS Global',              'Visa',      'Dubai/UK/Europe',   4, '2244334455', 'partner@vfsglobal.com'],
    ['Taj Hotels Corporate',    'Hotel',     'Pan India',         5, '2266660000', 'corporate@tajhotels.com'],
    ['OYO Business',            'Hotel',     'Pan India',         3, '1244889900', 'business@oyorooms.com'],
    ['SOTC Wholesale',          'DMC',       'International',     4, '2239884488', 'wholesale@sotc.in'],
    ['Kerala Tourism DMC',      'DMC',       'Kerala',            4, '4712345678', 'bookings@keralatourismdmc.in'],
    ['Himalayan Adventures',    'Activity',  'Manali/Leh',        4, '1902345678', 'ops@himalayanadventures.in'],
    ['Dubai Desert Safari Co.', 'Activity',  'Dubai',             5, '97143216789','book@dubaidesertsafari.ae'],
    ['JW Marriott Corporate',   'Hotel',     'Dubai/Goa',         5, '2266778899', 'corporate@marriott.com'],
    ['SpiceJet Corporate',      'Airline',   'Domestic',          3, '1244090909', 'corporate@spicejet.com'],
    ['Air India Corporate',     'Airline',   'All Routes',        4, '1124603020', 'corporate@airindia.com'],
    ['Andaman Discover',        'DMC',       'Andaman',           4, '3192345678', 'packages@andamandiscover.com'],
    ['Corbett Jungle Resorts',  'Hotel',     'Jim Corbett',       4, '5942345678', 'reservations@corbettjungle.in'],
    ['Cox & Kings Wholesale',   'DMC',       'International',     4, '2222877000', 'wholesale@coxandkings.com'],
    ['RedBus Corporate',        'Transport', 'Pan India',         3, '8042345678', 'business@redbus.in'],
    ['Thomas Cook Forex',       'Forex',     'Pan India',         4, '1861000700', 'forex@thomascook.in'],
    ['ICICI Lombard Travel',    'Insurance', 'Pan India',         4, '1860502060', 'travel@icicilombard.com'],
    ['Maldives Luxury Resorts', 'Hotel',     'Maldives',          5, '9607654321', 'reservations@maldivesluxury.mv'],
    ['Singapore Fly DMC',       'DMC',       'Singapore/Malaysia',4, '6565432100', 'packages@sgflydmc.com'],
    ['Europe Wonders DMC',      'DMC',       'Europe',            4, '33142345678','groups@europewonders.eu'],
    ['Sri Lanka Holidays',      'DMC',       'Sri Lanka',         4, '94112345678','packages@srilanka-holidays.lk'],
    ['Vietnam Travel Co.',      'DMC',       'Vietnam',           4, '84243210987','bookings@vietnamtravel.vn'],
  ];
  const vendorCount = await pool.query('SELECT COUNT(*) FROM vendors');
  if (parseInt(vendorCount.rows[0].count) === 0) {
    for (const [name, type, location, rating, phone, email] of vendors) {
      await pool.query(
        'INSERT INTO vendors (name, type, location, rating, phone, email) VALUES ($1,$2,$3,$4,$5,$6)',
        [name, type, location, rating, phone, email]
      );
    }
  }
  console.log('    Done.');

  // ── Summary ──
  const tables = ['users','employees','leads','quotations','bookings','tasks','visa_applications','invoices','vendors'];
  console.log('\n  Seed Summary:');
  for (const t of tables) {
    const r = await pool.query(`SELECT COUNT(*) FROM ${t}`);
    console.log(`    ${t.padEnd(20)} ${r.rows[0].count} records`);
  }
  console.log('\n  Seed complete!\n');
  await pool.end();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
