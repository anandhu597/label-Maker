/* =====================================================================
   FILE LABEL MAKER  -  script.js  (how everything BEHAVES)

   Contents:
     1. Settings
     2. Data: companies and document presets
     3. State: the values the app remembers
     4. Small helper functions
     5. Building ONE label (HTML text)
     6. Drawing on the screen: preview and sheet
     7. Saving and loading (browser storage)
     8. The form: typing, presets, logo upload
     9. The buttons: add, clear, remove
    10. Download PDF
    11. Start-up
   ===================================================================== */


/* ---------------------------------------------------------------------
   1. SETTINGS
   --------------------------------------------------------------------- */

// How many labels fit on one A4 landscape sheet
const MAX_LABELS = 5;

// Name used when saving your work in the browser (see section 7)
const STORAGE_KEY = 'fileLabelMaker';


/* ---------------------------------------------------------------------
   2. DATA
   --------------------------------------------------------------------- */

// The two built-in companies. "Custom" uses what you type in the form.
const COMPANIES = {
  shula: {
    name: 'Al Shula General Trading Co. L.L.C.',
    arabic: 'شركة الشعلة للتجارة العامة ش.ذ.م.م',
    color: '#d71920'                       // colour of the flame icon
  },
  quraishi: {
    name: 'Al Quraishi Trading Company',
    arabic: 'شركة القرشي للتجارة',
    color: '#0b6b4a'
  }
};

// Document presets. Format:  'KEY': [title, banner colour, text colour]
const PRESETS = {
  'INV':              ['INV',              '#ffff00', '#000000'],  // yellow
  'CRN':              ['CRN',              '#ff9a1f', '#000000'],  // orange
  'JV':               ['JV',               '#9fd2f2', '#000000'],  // light blue
  'PURCHASE ORDERS':  ['PURCHASE ORDERS',  '#0e6b73', '#ffffff'],  // dark teal
  'PAYMENT VOUCHERS': ['PAYMENT VOUCHERS', '#6b2fa0', '#ffffff']   // purple
};


/* ---------------------------------------------------------------------
   3. STATE  (the values the app keeps in memory)
   --------------------------------------------------------------------- */

// What is currently typed in the form. Each key matches a
// data-field="..." in index.html.
let form = {
  company: 'shula',
  year: '2026',
  volume: '01',
  code: 'U01-INV',
  preset: 'INV',
  title: 'INV',
  bgColor: '#ffff00',
  textColor: '#000000',
  from: '',
  to: '',
  customName: '',
  customArabic: '',
  customColor: '#1d4ed8'
};

// Labels already added to the sheet (a list of copies of "form")
let queue = [];

// Uploaded logo pictures, one per company, e.g. { shula: 'data:image/png...' }
let logos = {};


/* ---------------------------------------------------------------------
   4. SMALL HELPER FUNCTIONS
   --------------------------------------------------------------------- */

// Short way to find an element by its id
function getEl(id) {
  return document.getElementById(id);
}

// Makes typed text safe to put inside HTML (stops "<" from breaking the page)
function escapeHtml(text) {
  return String(text == null ? '' : text).replace(/[&<>"]/g, function (char) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[char];
  });
}

// "01" -> "VOL.01"   (also fixes "vol.01" typed by mistake)
function volumeText(data) {
  return 'VOL.' + String(data.volume).replace(/^vol\.?/i, '');
}

// Picks a font size so long text still fits the narrow label.
// The longest WORD decides the size, because spaces can wrap to a new line.
function fitFontSize(text, maxSize, availableWidth) {
  const words = String(text).split(/\s+/);
  let longest = 1;
  for (const word of words) {
    longest = Math.max(longest, word.length);
  }
  const size = availableWidth / (longest * 0.7);   // 0.7 = average letter width
  return Math.max(11, Math.min(maxSize, size)).toFixed(1);   // between 11px and max
}


/* ---------------------------------------------------------------------
   5. BUILDING ONE LABEL
   Takes a data object and returns the label as HTML text.
   Both the preview and the sheet use this same function.
   --------------------------------------------------------------------- */
function buildLabel(data) {

  // Which company details to use?
  let company;
  if (data.company === 'custom') {
    company = { name: data.customName, arabic: data.customArabic, color: data.customColor };
  } else {
    company = COMPANIES[data.company];
  }

  // Header: an uploaded logo if there is one, otherwise icon + names
  let headerHtml;
  const uploadedLogo = logos[data.company];
  if (uploadedLogo) {
    headerHtml = '<img class="lbl-logo-img" src="' + uploadedLogo + '" alt="">';
  } else {
    headerHtml =
      '<svg class="lbl-emblem" viewBox="0 0 40 40">' +
        '<path d="M21 2c2 7 12 11 12 22a12 12 0 0 1-24 0c0-6 3-9 6-13 0 3 1 5 3 6 0-6-1-10 3-15z" fill="' + escapeHtml(company.color) + '"/>' +
        '<path d="M21 24c2 3 5 5 5 9a5 5 0 0 1-10 0c0-4 3-6 5-9z" fill="#fff"/>' +
      '</svg>' +
      '<div class="lbl-names">' +
        '<span class="lbl-arabic" dir="rtl">' + escapeHtml(company.arabic) + '</span>' +
        '<span class="lbl-english">' + escapeHtml(company.name) + '</span>' +
      '</div>';
  }

  // Text for the rows
  const volume = volumeText(data);

  // Font sizes (150 = usable width in pixels inside the label)
  const yearSize   = 'font-size:' + fitFontSize(data.year,  40, 150) + 'px';
  const volumeSize = 'font-size:' + fitFontSize(volume,     30, 150) + 'px';
  const codeSize   = 'font-size:' + fitFontSize(data.code,  26, 150) + 'px';
  const titleSize  = 'font-size:' + fitFontSize(data.title, 32, 150) + 'px';

  // The banner colours come from the data
  const bannerStyle =
    'background:' + escapeHtml(data.bgColor) + ';' +
    'color:' + escapeHtml(data.textColor) + ';' + titleSize;

  // Put all the rows together, top to bottom
  return (
    '<div class="lbl">' +
      '<div class="lbl-row lbl-header"><div class="lbl-logobox">' + headerHtml + '</div></div>' +
      '<div class="lbl-row lbl-year" style="' + yearSize + '">' + escapeHtml(data.year) + '</div>' +
      '<div class="lbl-row lbl-volume" style="' + volumeSize + '">' + escapeHtml(volume) + '</div>' +
      '<div class="lbl-row lbl-code" style="' + codeSize + '">' + escapeHtml(data.code) + '</div>' +
      '<div class="lbl-row lbl-banner" style="' + bannerStyle + '">' + escapeHtml(data.title) + '</div>' +
      '<div class="lbl-row lbl-range"><span>from</span><b>' + escapeHtml(data.from) + '</b></div>' +
      '<div class="lbl-row lbl-range"><span>to</span><b>' + escapeHtml(data.to) + '</b></div>' +
      '<div class="lbl-bar"></div>' +
    '</div>'
  );
}

// All queued labels, each wrapped in a dashed cutting-guide box
function buildAllCells() {
  let html = '';
  for (const data of queue) {
    html += '<div class="cell">' + buildLabel(data) + '</div>';
  }
  return html;
}


/* ---------------------------------------------------------------------
   6. DRAWING ON THE SCREEN
   --------------------------------------------------------------------- */

// Redraw the single preview label
function drawPreview() {
  getEl('preview').innerHTML = buildLabel(form);
  saveData();
}

// Redraw the sheet, the counter, the remove buttons and the messages
function drawSheet() {

  // The paper: the labels, or a hint if there are none yet
  if (queue.length > 0) {
    getEl('sheet').innerHTML = buildAllCells();
  } else {
    getEl('sheet').innerHTML =
      '<p class="empty-msg">No labels yet. Fill in the details and choose “Add label to sheet”.</p>';
  }

  // Counter: "(3 of 5 labels)"
  getEl('count').textContent = '(' + queue.length + ' of ' + MAX_LABELS + ' labels)';

  // Enable/disable buttons
  getEl('addBtn').disabled = queue.length >= MAX_LABELS;   // full sheet
  getEl('clearBtn').disabled = queue.length === 0;         // nothing to clear
  getEl('pdfBtn').disabled = queue.length === 0;           // nothing to print

  // One remove button per label. data-index remembers its position.
  let chipsHtml = '';
  queue.forEach(function (data, index) {
    const name = escapeHtml(volumeText(data) + ' ' + data.code);
    chipsHtml += '<button class="chip" type="button" data-index="' + index +
                 '" aria-label="Remove label ' + name + '">' + name + ' ✕</button>';
  });
  getEl('chips').innerHTML = chipsHtml;

  // Message when full
  getEl('status').textContent =
    queue.length >= MAX_LABELS ? 'The sheet is full. Remove a label to add another.' : '';

  shrinkSheetToFit();
  saveData();
}

// The paper is 297mm wide, which is wider than most screens.
// Shrink it on screen only (the PDF always uses the full size).
function shrinkSheetToFit() {
  const sheet = getEl('sheet');
  const wrap = getEl('sheetWrap');
  const scale = Math.min(1, wrap.clientWidth / sheet.offsetWidth);
  sheet.style.transform = 'scale(' + scale + ')';
  wrap.style.height = (sheet.offsetHeight * scale) + 'px';   // keep the box the right height
}


/* ---------------------------------------------------------------------
   7. SAVING AND LOADING
   The browser remembers your form, labels and logos between visits.
   try/catch = "if saving is blocked, just carry on".
   --------------------------------------------------------------------- */
function saveData() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ form: form, queue: queue, logos: logos }));
  } catch (error) { /* ignore */ }
}

function loadData() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (saved) {
      Object.assign(form, saved.form || {});
      queue = (saved.queue || []).slice(0, MAX_LABELS);
      logos = saved.logos || {};
    }
  } catch (error) { /* ignore */ }
}


/* ---------------------------------------------------------------------
   8. THE FORM
   --------------------------------------------------------------------- */

// Copy the values from "form" INTO the input boxes
function fillFormFields() {
  document.querySelectorAll('[data-field]').forEach(function (input) {
    input.value = form[input.dataset.field];
  });
  // Show the custom-company boxes only when "Custom" is selected
  getEl('customFields').hidden = form.company !== 'custom';
}

// Runs every time you type in or change ANY field
function onFieldChange(event) {
  const name = event.target.dataset.field;   // e.g. "year"
  form[name] = event.target.value;           // save what was typed

  // Chose a preset -> fill title and colours from PRESETS
  if (name === 'preset' && PRESETS[form.preset]) {
    form.title     = PRESETS[form.preset][0];
    form.bgColor   = PRESETS[form.preset][1];
    form.textColor = PRESETS[form.preset][2];
    fillFormFields();
  }

  // Picked a colour by hand -> the preset becomes "Custom colours"
  if (name === 'bgColor' || name === 'textColor') {
    form.preset = 'custom';
    fillFormFields();
  }

  // Changed company -> show or hide the custom boxes
  if (name === 'company') {
    getEl('customFields').hidden = form.company !== 'custom';
  }

  drawPreview();
}

// Upload your own logo picture for the selected company
function onLogoChosen(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function () {
    logos[form.company] = reader.result;   // the picture as text
    drawPreview();
    drawSheet();
  };
  reader.readAsDataURL(file);
}

// Remove the uploaded logo, go back to the default one
function onResetLogo() {
  delete logos[form.company];
  getEl('logoInput').value = '';
  drawPreview();
  drawSheet();
}


/* ---------------------------------------------------------------------
   9. THE BUTTONS
   --------------------------------------------------------------------- */

// "Add label to sheet"
function onAddLabel() {
  if (queue.length >= MAX_LABELS) return;

  queue.push(Object.assign({}, form));   // add a COPY of the current form

  // Optionally raise the volume: 01 -> 02, 009 -> 010
  if (getEl('autoBump').checked) {
    const match = String(form.volume).match(/^(\D*)(\d+)$/);   // letters + digits
    if (match) {
      const prefix = match[1];
      const digits = match[2];
      const next = String(Number(digits) + 1).padStart(digits.length, '0');
      form.volume = prefix + next;
      fillFormFields();
    }
  }

  drawPreview();
  drawSheet();
}

// "Clear sheet"
function onClearSheet() {
  queue = [];
  drawSheet();
}

// Click a small ✕ button to remove one label
function onChipClick(event) {
  const button = event.target.closest('[data-index]');
  if (!button) return;
  queue.splice(Number(button.dataset.index), 1);   // remove 1 item at that position
  drawSheet();
}


/* ---------------------------------------------------------------------
   10. DOWNLOAD PDF
   The sheet on screen is shrunk, so we build a full-size hidden copy
   and turn THAT into a PDF.
   --------------------------------------------------------------------- */
async function onDownloadPdf() {
  if (queue.length === 0) return;

  const button = getEl('pdfBtn');
  const status = getEl('status');
  button.disabled = true;
  button.textContent = 'Preparing PDF…';
  status.textContent = '';

  // Hidden full-size copy, placed far off-screen
  const hidden = document.createElement('div');
  hidden.style.cssText = 'position:fixed;left:-10000px;top:0';
  hidden.innerHTML = '<div class="paper">' + buildAllCells() + '</div>';
  document.body.appendChild(hidden);

  try {
    await document.fonts.ready;   // wait until the font is loaded

    await html2pdf().set({
      margin: 0,                                           // no page margin
      filename: 'file-labels-' + form.year + '.pdf',
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' }
    }).from(hidden.firstChild).save();

    status.textContent = 'PDF downloaded.';
  } catch (error) {
    status.textContent = 'The PDF could not be created. Try again.';
  } finally {
    hidden.remove();                      // delete the hidden copy
    button.textContent = 'Download PDF';
    drawSheet();                          // restores button states
  }
}


/* ---------------------------------------------------------------------
   11. START-UP  (runs once when the page opens)
   --------------------------------------------------------------------- */

// Connect every input box to onFieldChange
document.querySelectorAll('[data-field]').forEach(function (input) {
  input.addEventListener('input', onFieldChange);
});

// Connect the buttons
getEl('logoInput').addEventListener('change', onLogoChosen);
getEl('resetLogoBtn').addEventListener('click', onResetLogo);
getEl('addBtn').addEventListener('click', onAddLabel);
getEl('clearBtn').addEventListener('click', onClearSheet);
getEl('chips').addEventListener('click', onChipClick);
getEl('pdfBtn').addEventListener('click', onDownloadPdf);

// Re-shrink the sheet when the window size changes
window.addEventListener('resize', shrinkSheetToFit);

// First draw
loadData();
fillFormFields();
drawPreview();
drawSheet();

// Draw again once the font has loaded so the text sizes are exact
if (document.fonts) {
  document.fonts.ready.then(function () {
    drawPreview();
    drawSheet();
  });
}
