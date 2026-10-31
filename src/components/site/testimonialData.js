// Video testimonials for "What Students Say". Fill in each student's name (and optionally their school
// or result in `detail`) in the same order as the videos: review_1.mp4 is the first entry.
// Thumbnails in /media/review-thumbs/ are frames taken from each video.
const NAMES = [
  '', '', '', '', '', '', '', '', '',
  '', '', '', '', '', '', '', '', '',
]
const DETAILS = []

export const TESTIMONIALS = NAMES.map((name, index) => ({
  name: name || `Student Story ${index + 1}`,
  detail: DETAILS[index] || 'Philomathean student',
  video: `/media/review_${index + 1}.mp4`,
  thumbnail: `/media/review-thumbs/review_${index + 1}.jpg`,
}))
