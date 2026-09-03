const admin = require('firebase-admin')
const { onCall } = require('firebase-functions/v2/https')
const mutations = require('./contentMutations')

admin.initializeApp()
exports.createResult = onCall(mutations.createResult)
exports.deleteResult = onCall(mutations.deleteResult)
exports.createPastPaper = onCall(mutations.createPastPaper)
exports.deletePastPaper = onCall(mutations.deletePastPaper)
