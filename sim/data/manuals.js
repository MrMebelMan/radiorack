// The manual PDFs in manuals/ and the public URL each one was downloaded from.
// Every source was checked byte-identical to the local file on 2026-10-05, except where noted.
export const MANUALS = {
  'gtr225-pilots-guide': { source: 'https://static.garmin.com/pumac/190-01182-00_d.pdf' },
  'gnc255-pilots-guide': { source: 'https://static.garmin.com/pumac/190-01182-01_e.pdf' },
  // The original host (redarrow.dolmint.com) is gone; this is its Wayback Machine capture.
  'gtr225-gnc255-installation-manual': { source: 'https://web.archive.org/web/20250504130727/https://redarrow.dolmint.com/sites/default/files/documents/GNC-255A_Install-Manual_HIGHLIGHTED.pdf' },
  'gtx328-pilots-guide': { source: 'https://static.garmin.com/pumac/GTX328Transponder_PilotsGuide.pdf' },
  'gtx328-installation-manual': { source: 'https://www.scribd.com/document/690272720/60004460-GTX328-InstallationManual' },
  'gtx328-maintenance-manual': { source: 'https://static.garmin.com/pumac/GTX328Transponder_MaintenanceManual.pdf' },
  'tt31-operating-manual': { source: 'https://trig-avionics.com/library/00454-00%20AF%20TT31%20Operating%20Handbook.pdf' },
  'tt31-installation-manual': { source: 'https://trig-avionics.com/library/00455-00%20AR%20TT31%20Installation%20Manual%20-%20Full.pdf' },
  'ar6201-operating-instructions': { source: 'https://www.becker-avionics.com/wp-content/uploads/2017/08/AR6201_OI.pdf' },
  'ar6201-installation-manual': { source: 'https://www.becker-avionics.com/wp-content/uploads/2017/08/AR6201_IO_SW3050149.pdf' },
  // A different edition of the brochure ("How to get the most from your King KMA 20"): the copy in
  // manuals/ ("Operating your KMA 20", 006-8200-05) has no public source.
  'kma20-operating-guide': {
    source: 'https://www.wpaviation.com/pdfs/king_kma20_pilot_guide.pdf',
    note: 'Public copy of another edition: "How to get the most from your King KMA 20"',
  },
  'kma20-installation-manual': { source: 'https://www.csobeech.com/files/KMA20-Manual.pdf' },
  'kn64-pilots-guide': { source: 'http://www.heilmannpub.com/kingpilotguides.pdf' },
  'kn64-installation-manual': { source: 'http://www.flymafc.com/docs/manuals/king-KN62_KN62A_KN64.pdf' },
};

// manuals/<id>.pdf
export const manualFile = (id) => `${id}.pdf`;
