import * as core from '@actions/core'
import * as builder from './builder'

async function run(): Promise<void> {
  try {
    let version = core.getInput('version', {required: false})
    await builder.buildJDK(version)
  } catch (error) {
    core.setFailed(error.message)
  }
}

run()
