import * as exec from '@actions/exec'
import * as core from '@actions/core'
import * as tc from '@actions/tool-cache'
import * as io from '@actions/io'
import { EXDEV } from 'constants'

const workDir = process.env['GITHUB_WORKSPACE']
//const dependenciesDir =  `${workDir}/tmp`
const jdkBootDir = `${workDir}/jdk/boot`
//const javaHomeDir = `${workDir}/jdk/home`

export async function buildJDK(
  javaToBuild: string,
  targetOs: string,
  architecture: string,
  impl: string
): Promise<void> {

  //set parameters and environment
  await exec.exec(`git clone https://github.com/AdoptOpenJDK/openjdk-build.git`)
  const time = new Date().toISOString().split('T')[0]
  const fileName = `Open${javaToBuild.toUpperCase()}-jdk_${architecture}_${targetOs}_${impl}_${time}`
  
  await io.mkdirP('jdk')
  process.chdir('jdk')
  await io.mkdirP('boot')
  await io.mkdirP('home')

  process.chdir(`${workDir}`)

  if (process.platform === 'darwin') {
    await exec.exec('brew install autoconf ccache coreutils')
  }
  
  const bootJDKVersion = getBootJdkVersion(javaToBuild)
  // should be updated to apiv3. Though looks like mac-openj9-10 doesn't work, leave as is for now.
  // const bootjdkJar = await tc.downloadTool(`https://api.adoptopenjdk.net/v3/binary/latest/${bootjdkVersion}/ga/${targetOs}/${architecture}/jdk/${impl}/normal/adoptopenjdk`)
  const bootjdkJar = await tc.downloadTool(`https://api.adoptopenjdk.net/v2/binary/releases/openjdk${bootJDKVersion}?openjdk_impl=${impl}&os=${targetOs}&arch=${architecture}&release=latest&heap_size=normal&type=jdk`)
  await exec.exec(`sudo tar -xzf ${bootjdkJar} -C ./jdk/boot --strip=3`)
  await io.rmRF(`${bootjdkJar}`)
  const jdk8Jar = await tc.downloadTool('https://api.adoptopenjdk.net/v2/binary/releases/openjdk8?os=mac&release=latest&arch=x64&heap_size=normal&type=jdk&openjdk_impl=hotspot')
  await exec.exec(`sudo tar -xzf ${jdk8Jar} -C ./jdk/home --strip=3`)
  await io.rmRF(`${jdk8Jar}`)
  core.exportVariable('JAVA_HOME', `${workDir}/jdk/boot`)//# Set environment variable JAVA_HOME, and prepend ${JAVA_HOME}/bin to PATH
  core.addPath(`${workDir}/jdk/boot/bin`)
  process.chdir('openjdk-build')
  //const CONFIG_ARGS = "--disable-ccache --disable-warnings-as-errors --with-extra-cxxflags='-stdlib=libc++ -mmacosx-version-min=10.8'"
  await exec.exec(`./makejdk-any-platform.sh \
  -J ${jdkBootDir} \
  --disable-shallow-git-clone \
  --configure-args "--disable-warnings-as-errors --with-extra-cxxflags='-stdlib=libc++ -mmacosx-version-min=10.8'" \
  -d artifacts \
  --target-file-name ${fileName}.tar.gz  \
  --use-jep319-certs \
  --build-variant ${impl} \
  --disable-adopt-branch-safety \
  ${javaToBuild}`)

  let platform = 'macosx-x86_64-normal-server-release'
  if ((parseInt(bootJDKVersion) + 1).toString() === '14') platform = 'macosx-x86_64-server-release' // TODO: this looks like a error in the README of Eclipse Openj9
  let jdkImages
  if (javaToBuild === 'jdk8u') {
    jdkImages = `workspace/build/src/build/${platform}/images/j2sdk-image`
    process.chdir(`${jdkImages}/jre/bin`)
  } else {
    jdkImages = `workspace/build/src/build/${platform}/images/jdk`
    process.chdir(`${jdkImages}/bin`)
  }
  await exec.exec(`./java -version`)
  core.setOutput(`Build${impl}JDK`, `${workDir}/openjdk-build/workspace/build/src/${jdkImages}`)
  process.chdir(`${workDir}`)
  await exec.exec(`find ./ -name ${fileName}.tar.gz`)
}

function getBootJdkVersion(javaToBuild: string): string {
  let bootJDKVersion = ''
  if (`${javaToBuild}` === 'jdk11u') {
    bootJDKVersion = '10'
  } else if (`${javaToBuild}` === 'jdk14u') {
    bootJDKVersion = '13'
  } else {
    core.error('not supported jdk version')
  }
  return bootJDKVersion
}