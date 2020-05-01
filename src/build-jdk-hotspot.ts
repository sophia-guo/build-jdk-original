import * as core from '@actions/core'
import * as builder from './builder'

async function run(): Promise<void> {
  try {
    const javaToBuild = core.getInput('javaToBuild', {required: false})
    const architecture = core.getInput('architecture', {required: false})
    const impl = core.getInput('impl', {required: false})
    const usePRRef = core.getInput('usePRRef') === 'true'
    await builder.buildJDK(javaToBuild, architecture, impl, usePRRef)
  } catch (error) {
    core.setFailed(error.message)
  }
}

run()
