// Starter templates shown on the home page. Each becomes a normal new file when picked.
const TEMPLATES = (() => {
  const text = (t, x, y, w, h, size, opts = {}) => ({ type: 'text', x, y, w, h, text: t, size, color: opts.color || '#222222', bold: !!opts.bold });
  const titleOnly = (title, body) => ({ bg: '#ffffff', items: [text(title, 60, 40, 840, 80, 36, { bold: true }), text(body, 60, 140, 840, 360, 24, { color: '#333333' })] });

  return [
    {
      app: 'writer', name: 'Resume', description: 'One-page resume with experience and skills',
      state: { title: 'Resume', html: `
<h1>Your Name</h1>
<p>City, Country · you@example.com · (555) 123-4567 · linkedin.com/in/you</p>
<h2>Summary</h2>
<p>Two or three sentences on who you are, what you're good at and what you're looking for.</p>
<h2>Experience</h2>
<h3>Job Title — Company</h3>
<p><i>Month Year – Present</i></p>
<ul><li>Achievement with a number: grew X by 30% by doing Y</li><li>Responsibility that shows scope</li><li>Tool or skill you used</li></ul>
<h3>Job Title — Company</h3>
<p><i>Month Year – Month Year</i></p>
<ul><li>Achievement with a number</li><li>Achievement with a number</li></ul>
<h2>Education</h2>
<p><b>Degree</b>, School — Year</p>
<h2>Skills</h2>
<p>Skill · Skill · Skill · Skill · Skill</p>` },
    },
    {
      app: 'writer', name: 'Cover letter', description: 'Short, structured job application letter',
      state: { title: 'Cover letter', html: `
<p>Your Name<br>you@example.com</p>
<p>Date</p>
<p>Hiring Manager<br>Company</p>
<p>Dear Hiring Manager,</p>
<p>I'm applying for the <b>Role</b> position at <b>Company</b>. One sentence on why this role and this company.</p>
<p>In my current role at <b>Company</b>, I [specific result]. That experience maps directly to [requirement from the job post].</p>
<p>I'd welcome the chance to talk about how I can help with [team goal]. Thank you for your time.</p>
<p>Sincerely,<br>Your Name</p>` },
    },
    {
      app: 'writer', name: 'Meeting notes', description: 'Agenda, decisions and action items',
      state: { title: 'Meeting notes', html: `
<h1>Meeting: Topic</h1>
<p><b>Date:</b> ${new Date().toLocaleDateString()} · <b>Attendees:</b> Name, Name, Name</p>
<h2>Agenda</h2>
<ol><li>Item one</li><li>Item two</li><li>Item three</li></ol>
<h2>Notes</h2>
<ul><li>Point discussed</li></ul>
<h2>Decisions</h2>
<ul><li>What was agreed</li></ul>
<h2>Action items</h2>
<table><tr><th>Task</th><th>Owner</th><th>Due</th></tr><tr><td>Do the thing</td><td>Name</td><td>Date</td></tr><tr><td><br></td><td><br></td><td><br></td></tr></table>` },
    },
    {
      app: 'sheets', name: 'Invoice', description: 'Line items, tax and total calculated for you',
      state: { title: 'Invoice', bold: { A1: true, A6: true, B6: true, C6: true, D6: true, C14: true, D14: true },
        raw: {
          A1: 'INVOICE', A2: 'Invoice #', B2: '001', A3: 'Date', B3: new Date().toISOString().slice(0, 10), A4: 'Bill to', B4: 'Client name',
          A6: 'Item', B6: 'Qty', C6: 'Price', D6: 'Total',
          A7: 'Design work', B7: '10', C7: '50', D7: '=B7*C7',
          A8: 'Consulting', B8: '2', C8: '120', D8: '=B8*C8',
          A9: '', D9: '=B9*C9', D10: '=B10*C10',
          C12: 'Subtotal', D12: '=SUM(D7:D10)', C13: 'Tax rate', D13: '0.1',
          C14: 'TOTAL', D14: '=ROUND(D12*(1+D13),2)',
        } },
    },
    {
      app: 'sheets', name: 'Monthly budget', description: 'Budget vs actual with differences',
      state: { title: 'Monthly budget', bold: { A1: true, B1: true, C1: true, D1: true, A10: true, B10: true, C10: true, D10: true },
        raw: {
          A1: 'Category', B1: 'Budget', C1: 'Actual', D1: 'Difference',
          A2: 'Rent', B2: '1200', C2: '1200', A3: 'Groceries', B3: '400', C3: '365', A4: 'Transport', B4: '150', C4: '180',
          A5: 'Utilities', B5: '120', C5: '110', A6: 'Phone & internet', B6: '80', C6: '80', A7: 'Fun', B7: '200', C7: '240',
          A8: 'Savings', B8: '500', C8: '500',
          D2: '=B2-C2', D3: '=B3-C3', D4: '=B4-C4', D5: '=B5-C5', D6: '=B6-C6', D7: '=B7-C7', D8: '=B8-C8',
          A10: 'Total', B10: '=SUM(B2:B8)', C10: '=SUM(C2:C8)', D10: '=B10-C10',
        } },
    },
    {
      app: 'slides', name: 'Pitch deck', description: 'Problem, solution, market, ask — 6 slides',
      state: { title: 'Pitch deck', deck: { slides: [
        { bg: '#1e3a5f', items: [text('Company Name', 80, 180, 800, 100, 54, { bold: true, color: '#ffffff' }), text('One line that says what you do', 80, 300, 800, 60, 26, { color: '#cfe0f5' })] },
        titleOnly('The problem', '• Who has it\n• How painful it is (with a number)\n• What they do today'),
        titleOnly('Our solution', '• What it is in one sentence\n• Why it works better\n• Screenshot or demo here'),
        titleOnly('Market', '• Who buys it\n• How many of them\n• How much they spend'),
        titleOnly('Traction', '• Users / revenue / growth\n• Key milestone\n• What\'s next'),
        { bg: '#1e3a5f', items: [text('The ask', 80, 160, 800, 90, 44, { bold: true, color: '#ffffff' }), text('How much, what it buys, and how to reach you', 80, 280, 800, 60, 24, { color: '#cfe0f5' })] },
      ] } },
    },
  ];
})();
