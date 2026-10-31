// Programme structure from the institute's priorities, shared by the home page, header menu and site search.
// Main programmes in priority order (the home page cards add icons and colours).
export const PROGRAMME_COURSES = [
  { title: 'IGCSE Mathematics', grades: 'Grades 9–10', courses: ['0607 International Mathematics (Core & Extended)', '0606 Additional Mathematics', '0580 Mathematics (Extended)'] },
  { title: 'IBDP Mathematics', grades: 'Grades 11–12', courses: ['Math AI SL', 'Math AA SL', 'Math AI HL', 'Math AA HL'] },
  { title: 'AS & A Level', grades: 'Grades 11–12', courses: ['AS Level', 'A Level'] },
  { title: 'IB MYP', grades: 'Grades 8–10', courses: ['MYP 3 (Grade 8)', 'MYP 4 (Grade 9)', 'MYP 5 (Grade 10)'] },
]
// Grades 6–8 foundation scheme: worksheets every year, then Checkpoint and Progression papers in Grade 8.
export const FOUNDATION_SCHEME = [['Grade 6', ['Worksheets']], ['Grade 7', ['Worksheets']], ['Grade 8', ['Worksheets', 'Checkpoint', 'Progression papers']]]
// Entrance-level exams, in priority order.
export const ENTRANCE_EXAMS = [['AMC', 'American Mathematics Competitions prep'], ['SAT', 'US college admissions'], ['Olympiad', 'Maths & science Olympiads'], ['PSAT', 'Preliminary SAT / NMSQT']]
// Other exams we still prepare students for, shown after the entrance exams in the menu.
export const OTHER_EXAMS = [['ACT', 'US college admissions'], ['UCAT', 'Medical school entrance'], ['TOEFL', 'English proficiency'], ['BMAT', 'Biomedical admissions']]
