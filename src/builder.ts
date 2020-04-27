import * as exec from '@actions/exec'
import * as core from '@actions/core'
import * as tc from '@actions/tool-cache'
import * as io from '@actions/io'
import { EXDEV } from 'constants'

let linuxContainer = ''
let linuxBootJDKUri = ''
let macOSBootJDKUri = ''
let windowsBootJDKUri = ''
let buildJavaVersion = ''
let buildJavaVariant = 'hotspot'
let buildJavaConfigure = ''
let freetypeUri = 'https://buildreqs.blob.core.windows.net/freetype/freetype-2.9.1.tar.gz'
let alsaUri = 'https://buildreqs.blob.core.windows.net/alsa/alsa-lib-1.1.6.tar.bz2'
const workDir = process.env['GITHUB_WORKSPACE']
const ADOPT_OPENJDK_BUILD_REPO_URI = `${workDir}/openjdk-build`
core.info(`workdir is ${workDir}`)
export async function buildJDK(
  version: string
): Promise<void> {
  await exec.exec(`git clone https://github.com/AdoptOpenJDK/openjdk-build.git`)
  process.env['JAVA_VESION'] = version
  process.env['DEBUG_LEVEL'] ='slowdebug'
  const bootjdkVersion = (parseInt(version) - 1).toString()
  const bootjdkJar = await tc.downloadTool(`https://api.adoptopenjdk.net/v2/binary/releases/openjdk${bootjdkVersion}?openjdk_impl=openj9&os=linux&arch=x64&release=latest&heap_size=normal&type=jdk`)
  await io.mkdirP('JDK_BOOT_DIR')
  await exec.exec('ls')
  await exec.exec(`sudo tar -xzf ${bootjdkJar} -C ./JDK_BOOT_DIR --strip=1`)
  await io.rmRF(`${bootjdkJar}`)
  core.exportVariable('JAVA_HOME', `${workDir}/JDK_BOOT_DIR`)//# Set environment variable JAVA_HOME, and prepend ${JAVA_HOME}/bin to PATH
  core.addPath(`${workDir}/JDK_BOOT_DIR/bin`)
  
  await exec.exec('printenv')
  process.chdir('openjdk-build')
  const CONFIG_ARGS = '--with-debug-level=slowdebug --disable-ccache --disable-warnings-as-errors'
  await exec.exec(`makejdk-any-platform.sh \
    --adoptopenjdk-build-repo ${ADOPT_OPENJDK_BUILD_REPO_URI} \
    -J ${workDir}/JDK_BOOT_DIR \
  --disable-shallow-git-clone \
  --configure-args "${CONFIG_ARGS}"  \
  -d artifacts \
  --target-file-name openjdkbuildtest-linux-x64.tar.gz  \
  --alsa-tarball-uri ${alsaUri} \
  --freetype-tarball-uri ${freetypeUri} \
  ${buildJavaConfigure} \
  --build-variant ${buildJavaVariant} \
  --disable-adopt-branch-safety \
  ${version}`)
  await exec.exec('find ./ -name openjdkbuildtest-linux-x64.tar.gz')
}

/* 
async function installDependencies(version: string): Promise<void> {
  await exec.exec('sudo apt-get update')
  await exec.exec(
    'sudo apt-get install -qq -y --no-install-recommends \
    software-properties-common \
    python-software-properties'
  )
//Note gcc-multilib is needed on github environment
  await exec.exec(`sudo apt-get update`)
  await exec.exec(
    'sudo apt-get install -qq -y --no-install-recommends \
    autoconf \
    ca-certificates \
    ccache \
    cmake \
    cpio \
    file \
    git \
    git-core \
    libasound2-dev \
    libcups2-dev \
    libdwarf-dev \
    libelf-dev \
    libfontconfig1-dev \
    libfreetype6-dev \
    libnuma-dev \
    libx11-dev \
    libxext-dev \
    libxrender-dev \
    libxt-dev \
    libxtst-dev \
    make \
    nasm \
    pkg-config \
    realpath \
    ssh \
    unzip \
    wget \
    gcc-multilib \
    zip'
  )
  await io.rmRF(`/var/lib/apt/lists/*`)

  if (version === '8') {
    core.info(` are we in correct location? which should be for ${version}`)
    await exec.exec('sudo add-apt-repository ppa:openjdk-r/ppa')
    await exec.exec(`sudo apt-get update`)
    await exec.exec(
      'sudo apt-get install -qq -y --no-install-recommends openjdk-7-jdk'
    )
    await io.rmRF(`/var/lib/apt/lists/*`)
  } else {
    await exec.exec(`sudo apt-get update`)
    await exec.exec(
      'sudo apt-get install -qq -y --no-install-recommends libxrandr-dev'
    )
    await io.rmRF(`/var/lib/apt/lists/*`)

  }

  process.chdir('/usr/local')
  core.info(`current path is ${process.cwd()}`)
  const gccBinary = await tc.downloadTool(`https://ci.adoptopenjdk.net/userContent/gcc/gcc730+ccache.x86_64.tar.xz`)
  core.info(`current path is ${process.cwd()}`)
  await exec.exec(`ls -l ${gccBinary}`)
  await exec.exec(`sudo tar -xJ --strip-components=1 -C /usr/local -f ${gccBinary}`)
  await io.rmRF(`${gccBinary}`)

  await exec.exec(`sudo ln -s /usr/lib/x86_64-linux-gnu /usr/lib64`)
  await exec.exec(`sudo ln -s /usr/include/x86_64-linux-gnu/* /usr/local/include`)
  await exec.exec(`sudo ln -sf /usr/local/bin/g++-7.3 /usr/bin/g++`)
  await exec.exec(`sudo ln -sf /usr/local/bin/gcc-7.3 /usr/bin/gcc`)
  process.chdir(`${workDir}`)
  const freeMarker = await tc.downloadTool(`https://sourceforge.net/projects/freemarker/files/freemarker/2.3.8/freemarker-2.3.8.tar.gz/download`)
  await exec.exec(`sudo tar -xzf ${freeMarker} freemarker-2.3.8/lib/freemarker.jar --strip=2`)
  await io.rmRF(`${freeMarker}`)
}

async function getSource(
  openj9Version: string,
  user: string,
  branch: string
): Promise<void> {
  await exec.exec(`git clone -b ${branch} https://github.com/${user}/${openj9Version}`)
  process.chdir(`${openj9Version}`)
  core.info(`current path is ${process.cwd()}`)
  await exec.exec(`bash ./get_source.sh`)
  await exec.exec(`bash configure --with-freemarker-jar=${workDir}/freemarker.jar`)
} */