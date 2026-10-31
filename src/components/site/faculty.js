// Faculty shown on the home page, /teachers and each teacher's profile.
// Each entry: [name, role, subject, photo, description, years of experience].
const unorderedFaculty = [
  ['Satish Vishwakarma', 'Founder & Director', 'Mathematics (IGCSE, IBDP & A Levels)', '/media/faculty-01.jpeg', 'Satish Vishwakarma Sir is the Founder & Director of Philomathean Career Institute Pvt. Ltd. and a highly accomplished Mathematics educator.', '12+'],
  ['Deepak Tripathi', 'IBDP Academic Leader', 'Physics (IGCSE, IBDP & A Levels)', '/media/faculty-02.jpeg', 'Deepak Tripathi Sir is the IBDP Academic Leader with 12+ years of teaching experience.', '12+'],
  ['Ashish Jha', 'A Levels Academic Leader', 'Physics & Chemistry (IGCSE, IBDP & A Levels)', '/media/faculty-03.jpeg', 'Ashish Jha Sir is the Academic Leader of the A Levels Department at Philomathean, with 10+ years of teaching experience.', '10+'],
  ['Akshara Agarwal', 'Educator', "Mathematics & Science (IGCSE)", '/media/faculty-04.jpeg', "Akshara Agarwal Ma'am is an experienced IGCSE Mathematics and Science faculty with 8+ years of teaching experience.", '8+'],
  ['Dipesh Paliwal', 'Educator', 'Mathematics (IGCSE & IBDP)', '/media/faculty-05.jpeg', 'Dipesh Paliwal Sir is a highly experienced Mathematics faculty specialising in IGCSE and IBDP.', '12+'],
  ['Meghna Shah', 'Educator', 'Mathematics & Science (IGCSE)', '/media/faculty-06.jpeg', 'Meghna Shah Ma’am is an experienced IGCSE Mathematics and Science faculty.', '10+'],
  ['Manikant Yadav', 'Educator', 'Physics, Chemistry & Biology (IGCSE)', '/media/faculty-07.jpeg', 'Manikant Yadav Sir is an experienced Science faculty specialising in Physics, Chemistry and Biology.', '10+'],
  ['Tushar Rajgor', 'Educator', 'Mathematics (IGCSE)', '/media/faculty-15.jpeg', 'Tushar Rajgor Sir is an experienced Mathematics faculty specialising in Grades 6 to 10.', '10+'],
  ['Pallavi Patole', 'Educator', 'Biology (IGCSE, IBDP & A Levels)', '/media/faculty-08.jpeg', 'Pallavi Patole Ma’am is an experienced Biology faculty specialising in IGCSE, IBDP, and A Levels.', '10+'],
  ['Ayushi Nishar', 'Educator', 'Economics & Business Studies (IGCSE & IBDP)', '/media/faculty-09.jpeg', 'Ayushi Nishar Ma’am is an experienced Economics and Business Studies faculty.', '12+'],
  ['Hitesh Dubal', 'Educator', 'Mathematics (IGCSE)', '/media/faculty-10.jpeg', 'Hitesh Dubal Sir is an experienced IGCSE Mathematics faculty specialising in Grades 6 to 10.', '10+'],
  ['Pawan Yadav', 'Educator', 'Mathematics (IGCSE & A Levels)', '/media/faculty-11.jpeg', 'Pawan Yadav Sir is an experienced Mathematics faculty specialising in IGCSE and A Levels.', '10+'],
  ['Anshul Bhide', 'Educator', 'Biology (IGCSE, IBDP & A Levels)', '/media/faculty-12.jpeg', 'Anshul Bhide Sir is an experienced Biology faculty specialising in IGCSE, IBDP, and A Levels.', '10+'],
  ['Siyana Bharucha', 'Educator', 'Psychology (IGCSE & IBDP)', '/media/faculty-13.jpeg', 'Siyana Bharucha Ma’am is a dedicated Psychology faculty specialising in IGCSE and IBDP.', '5+'],
  ['Taragini Menon', 'Educator', 'English (IGCSE & IBDP)', '/media/faculty-14.jpeg', 'Taragini Menon Ma’am is an experienced English faculty specialising in IGCSE and IBDP.', '10+'],
  ['Prasad Bharat Ghadi', 'Educator', 'Chemistry (IGCSE, IBDP & A Levels)', '/media/faculty-16.jpeg', 'Prasad Bharat Ghadi Sir is an experienced Chemistry faculty specialising in IGCSE, IBDP, and A Levels.', '10+'],
  ['Zeel Gandhi', 'Educator', 'Mathematics & Science (IGCSE)', '/media/faculty-17.jpeg', 'Zeel Gandhi Ma’am is an experienced IGCSE Mathematics and Science faculty.', '5+'],
  ['Pankaj Yadav', 'Educator', 'Mathematics | Grades 6–8 (IGCSE, IB MYP & Foundation Programme)', '/media/pankaj-yadav.jpeg', 'With 5+ years of teaching experience, Mr. Pankaj Yadav is a dedicated Mathematics educator committed to building a strong conceptual foundation for students in Grades 6–8.', '5+'],
  ["Shreya Ma'am", 'Educator', 'Mathematics, Science, English, EVS, and Social Studies', '/media/shreya.jpeg', "Shreya Ma'am is a dedicated educator with 3–4 years of teaching experience, specializing in Mathematics, Science, English, EVS, and Social Studies for students from Grades 1 to 8.", '3+'],
]
const rinky = ['Rinky Vishwakarma', 'Educator', 'Mathematics (IGCSE)', '/media/faculty-18.jpeg', 'Rinky Vishwakarma Ma’am is an experienced IGCSE Mathematics faculty.', '5+']

// Teaching hierarchy, in order: these teachers are listed first everywhere, the rest follow in their usual order.
export const TEACHER_HIERARCHY = ['Satish Vishwakarma', 'Pawan Yadav', 'Meghna Shah', 'Pallavi Patole', 'Pankaj Yadav', 'Ayushi Nishar', 'Siyana Bharucha']
const rank = (member) => { const index = TEACHER_HIERARCHY.indexOf(member[0]); return index === -1 ? TEACHER_HIERARCHY.length : index }
const byHierarchy = (list) => list.map((member, index) => [member, index]).sort((a, b) => rank(a[0]) - rank(b[0]) || a[1] - b[1]).map(([member]) => member)

const allFaculty = byHierarchy([...unorderedFaculty, rinky])
// Home page: the teaching hierarchy, then Akshara Agarwal.
export const faculty = [...allFaculty.slice(0, TEACHER_HIERARCHY.length), ...allFaculty.filter((member) => member[0] === 'Akshara Agarwal')]
export const directorFaculty = [unorderedFaculty[0], rinky]
// On /teachers, Deepak Tripathi and Ashish Jha are listed last.
const LISTED_LAST = ['Deepak Tripathi', 'Ashish Jha']
const educators = allFaculty.filter((member) => !directorFaculty.includes(member))
export const educatorFaculty = [...educators.filter((member) => !LISTED_LAST.includes(member[0])), ...LISTED_LAST.map((name) => educators.find((member) => member[0] === name)).filter(Boolean)]
export const everyTeacher = [...directorFaculty, ...educatorFaculty]

export const teacherSlug = (name) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
export const isLeadershipName = (name) => name === 'Satish Vishwakarma' || name === 'Rinky Vishwakarma'
export const teacherSubjects = ['Mathematics', 'Physics', 'Chemistry', 'Biology', 'Economics', 'English', 'Psychology']
export const teachesSubject = (member, subject) => member[2].toLowerCase().includes(subject.toLowerCase())
