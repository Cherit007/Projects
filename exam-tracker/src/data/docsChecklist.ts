export type DocItem = {
  id: string
  title: string
  hint: string
}

/** Application kit — inspired by bank/regulator form checklists */
export const DOC_ITEMS: DocItem[] = [
  {
    id: 'obc-ncl',
    title: 'OBC-NCL certificate (recent)',
    hint: 'Non-creamy layer — usually needed at interview; keep digital + hard copy',
  },
  {
    id: 'photo',
    title: 'Passport photo (spec-ready)',
    hint: 'White/light background; match IBPS/SBI size notes when applying',
  },
  {
    id: 'signature',
    title: 'Signature scan',
    hint: 'Black ink on white; clear edges for upload',
  },
  {
    id: 'id-proof',
    title: 'ID proof (Aadhaar / PAN / Passport)',
    hint: 'Name must match degree & category certificates',
  },
  {
    id: 'degree',
    title: 'Degree / provisional + marksheets',
    hint: 'B.Tech ECE — keep all semesters + consolidated',
  },
  {
    id: 'experience',
    title: 'Experience letters / payslips',
    hint: 'Useful for SBI SCO / AAI Manager IT laterals',
  },
  {
    id: 'gate',
    title: 'GATE CS scorecard (if any)',
    hint: 'NIC / DRDO / POWERGRID path — optional until you commit',
  },
  {
    id: 'email-phone',
    title: 'Active email + phone for OTPs',
    hint: 'Same ones you’ll use across IBPS / SBI / SEBI portals',
  },
]
