/*
 Publishes Jest results to TestRail using API v2.
 Requires GitHub Secrets or env vars:
  - TESTRAIL_HOST (e.g. https://your.testrail.io)
  - TESTRAIL_USERNAME (email)
  - TESTRAIL_API_KEY (API key)
  - TESTRAIL_PROJECT_ID (number)
  - TESTRAIL_SUITE_ID (number, 0 if single repository)

 It reads ./reports/jest-results.json produced by `npm run test:ci`.
 Test titles must include a case ID like `C123: description...`.
*/

const fs = require('fs')
const path = require('path')
const axios = require('axios')

function env(name, required = true) {
  const v = process.env[name]
  if (required && !v) throw new Error(`Missing env: ${name}`)
  return v
}

async function main() {
  const host = env('TESTRAIL_HOST', false)
  const username = env('TESTRAIL_USERNAME', false)
  const apiKey = env('TESTRAIL_API_KEY', false)
  const projectId = Number(env('TESTRAIL_PROJECT_ID', false) || '0')
  const suiteId = Number(env('TESTRAIL_SUITE_ID', false) || '0')

  // Skip if TestRail not configured
  if (!host || !username || !apiKey || !projectId) {
    console.log('⚠️  TestRail credentials not configured. Skipping publish.')
    console.log('   Tests passed successfully but results not sent to TestRail.')
    console.log('   To enable: Set TESTRAIL_HOST, TESTRAIL_USERNAME, TESTRAIL_API_KEY, TESTRAIL_PROJECT_ID in GitHub Secrets.')
    return
  }

  const api = axios.create({
    baseURL: host.replace(/\/$/, '') + '/index.php?/api/v2/',
    auth: { username, password: apiKey },
    headers: { 'Content-Type': 'application/json' },
  })

  const reportPath = path.resolve(process.cwd(), 'reports', 'jest-results.json')
  if (!fs.existsSync(reportPath)) {
    console.log('No jest-results.json found, skipping publish.')
    return
  }
  const data = JSON.parse(fs.readFileSync(reportPath, 'utf8'))

  // Collect case results from Jest JSON
  // Look into testResults[].assertionResults[]
  const caseResults = []
  for (const tr of data.testResults || []) {
    for (const ar of tr.assertionResults || []) {
      const m = /C(\d+)/i.exec(ar.title)
      if (!m) continue
      const caseId = Number(m[1])
      const status = ar.status // passed | failed | skipped
      let statusId = 1 // Passed
      if (status === 'failed') statusId = 5 // Failed
      if (status === 'skipped' || status === 'pending' || status === 'todo') statusId = 2 // Blocked as placeholder
      const comment = (ar.failureMessages || []).join('\n') || 'Automated result'
      caseResults.push({ case_id: caseId, status_id: statusId, comment })
    }
  }

  if (caseResults.length === 0) {
    console.log('No TestRail case IDs (C<id>) found in test titles. Nothing to publish.')
    return
  }

  const runName = `API Tests - ${new Date().toISOString()}`
  const runResp = await api.post(`add_run/${projectId}`, {
    suite_id: suiteId > 0 ? suiteId : undefined,
    name: runName,
    include_all: false,
    case_ids: caseResults.map(r => r.case_id),
  })
  const runId = runResp.data.id
  console.log('Created TestRail run:', runId)

  await api.post(`add_results_for_cases/${runId}`, { results: caseResults })
  console.log('Published results for', caseResults.length, 'cases')

  // Close run to keep board clean
  await api.post(`close_run/${runId}`)
  console.log('Closed run', runId)
}

main().catch(err => {
  console.error('Failed to publish to TestRail:', err.response?.data || err.message)
  process.exit(1)
})
