const directorBiography = `Mr. Satish Vishwakarma is the Founder & Director of Philomathean Career Institute Pvt. Ltd., a passionate educator and visionary leader committed to transforming education through excellence, innovation, and mentorship. With over a decade of experience in mathematics and competitive exam coaching, he has empowered hundreds of students to achieve exceptional academic success across IGCSE, IB (MYP & IBDP), A & AS Levels, SAT, PSAT, Checkpoint, Olympiads, JEE, and NEET.

His philosophy extends beyond teaching concepts—it focuses on nurturing confidence, analytical thinking, discipline, and a lifelong passion for learning. Under his leadership, Philomathean has become a trusted destination for students aspiring to achieve academic excellence while developing the skills needed to thrive in a competitive world.

Driven by the belief that "Quality Education Creates Limitless Possibilities," Mr. Vishwakarma continues to build a learning ecosystem where every student receives personalized guidance, world-class resources, and unwavering mentorship. His vision is to establish Philomathean as one of India's most respected global education institutes, producing future leaders, innovators, and changemakers.`

const directorQuote = `Success is not built by talent alone—it is built through the right guidance, consistent effort, and an unwavering belief in one's potential.`

function updateDirectorVision() {
  const founder = document.querySelector('.founder')
  if (!founder) return false

  const intro = founder.querySelector('.section-intro > p')
  const summary = founder.querySelector('.founder-content > p')
  const philosophy = founder.querySelector('.philosophy')
  const portrait = founder.querySelector('.founder-photo > img')
  if (intro) intro.textContent = 'Founder & Director of Philomathean Career Institute Pvt. Ltd. — a passionate educator and visionary leader.'
  if (summary) summary.textContent = directorBiography
  if (portrait) portrait.src = '/media/satish.jpeg'
  if (philosophy) {
    philosophy.querySelector('h3').textContent = 'Director Vision'
    philosophy.querySelectorAll('p').forEach((paragraph) => paragraph.remove())
    const quote = document.createElement('p')
    quote.textContent = directorQuote
    philosophy.insertBefore(quote, philosophy.querySelector('a'))
  }
  return true
}

const observer = new MutationObserver(() => {
  if (updateDirectorVision()) observer.disconnect()
})

observer.observe(document.documentElement, { childList: true, subtree: true })
updateDirectorVision()