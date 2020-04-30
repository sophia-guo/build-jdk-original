import * as core from '@actions/core'
import * as builder from './builder'

async function run(): Promise<void> {
  try {
    let javaToBuild = core.getInput('javaToBuild', {required: false})
    let targetOs = core.getInput('targetOs', {required: false})
    let architecture = core.getInput('architecture', {required: false})
    let impl = core.getInput('impl', {required: false})
    if (!javaToBuild) javaToBuild = 'jdk11u'
    if (!targetOs) targetOs = 'mac'
    if (!architecture) architecture = 'x64'
    if (!impl) impl = 'hotspot'
    await builder.buildJDK(javaToBuild, targetOs, architecture, impl)
  } catch (error) {
    core.setFailed(error.message)
  }
}

run()
