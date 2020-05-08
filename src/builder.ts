import * as exec from '@actions/exec'
import * as core from '@actions/core'
import * as tc from '@actions/tool-cache'
import * as io from '@actions/io'
import { EXDEV } from 'constants'

const workDir = process.env['GITHUB_WORKSPACE']
//const dependenciesDir =  `${workDir}/tmp`
const jdkBootDir = `${workDir}/jdk/boot`
//const javaHomeDir = `${workDir}/jdk/home`
let buildDir = workDir as string
const IS_WINDOWS = process.platform === "win32"
const targetOs = IS_WINDOWS ? 'windows' : process.platform === 'darwin' ? 'mac' : 'linux'

export async function buildJDK(
  javaToBuild: string,
  architecture: string,
  impl: string,
  usePRRef: boolean
): Promise<void> {

  await getOpenjdkBuildResource(usePRRef)
  core.info(`build Dir is ${buildDir}`)
  core.info(`current dir is ${process.cwd()}`)
  //set parameters and environment
  const time = new Date().toISOString().split('T')[0]
  const fileName = `Open${javaToBuild.toUpperCase()}-jdk_${architecture}_${targetOs}_${impl}_${time}`
  await io.mkdirP('jdk')
  process.chdir('jdk')
  await io.mkdirP('boot')
  await io.mkdirP('home')
  process.chdir(`${workDir}`)
  await exec.exec('ls')
  core.info(`current path is ${process.cwd()}`)

  //pre-install dependencies
  await installDependencies(javaToBuild, impl)
  await exec.exec('ls')
  core.info(`current path is ${process.cwd()}`)
  await getBootJdk(javaToBuild, impl)
  await exec.exec('ls')
  core.info(`current path is ${process.cwd()}`)
  
  //got to build Dir
  process.chdir(`${buildDir}`)
  
  //build

  if (`${targetOs}` === 'mac') {
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
  } else if (`${impl}` === 'hotspot'){
    await exec.exec(`./makejdk-any-platform.sh \
    -J ${jdkBootDir} \
    --disable-shallow-git-clone \
    --configure-args "--disable-ccache --enable-dtrace=auto --disable-warnings-as-errors" \
    -d artifacts \
    --target-file-name ${fileName}.tar.gz  \
    --use-jep319-certs \
    --build-variant ${impl} \
    --disable-adopt-branch-safety \
    ${javaToBuild}`)
  } else {
    await exec.exec(`./makejdk-any-platform.sh \
    -J ${jdkBootDir} \
    --disable-shallow-git-clone \
    --configure-args "--disable-ccache --enable-jitserver --enable-dtrace=auto --disable-warnings-as-errors --with-openssl=/usr/local/openssl-1.0.2 --enable-cuda --with-cuda=/usr/local/cuda-9.0" \
    -d artifacts \
    --target-file-name ${fileName}.tar.gz  \
    --use-jep319-certs \
    --build-variant ${impl} \
    --disable-adopt-branch-safety \
    ${javaToBuild}`)
  }

  // TODO: update directory for ubuntu
  // await printJavaVersion(javaToBuild)
  process.chdir(`${workDir}`)

  try {
    await exec.exec(`find ./ -name ${fileName}.tar.gz`)
  } catch (error) {
    core.setFailed(`build failed and ${error.message}`)
  }
}

async function getOpenjdkBuildResource(usePPRef: Boolean): Promise<void> {
  if (!usePPRef) {
    await exec.exec(`git clone --depth 1 https://github.com/AdoptOpenJDK/openjdk-build.git`)
    buildDir = `${workDir}/openjdk-build`
  }
}

async function installDependencies(javaToBuild: string, impl: string): Promise<void> {
  /* install common dependencies place holder */

  // install based on OS
  if (`${targetOs}` === 'mac') {
    await exec.exec('brew install autoconf ccache coreutils')
    if (`${impl}` === 'openj9') {
      await exec.exec('brew install bash nasm')
    }
  } else if (`${targetOs}` === 'linux') {
    await exec.exec(`sudo apt-get update`)
    await exec.exec(
      'sudo apt-get install -qq -y --no-install-recommends \
      autoconf \
      ccache \
      cpio \
      git-core \
      build-essential \
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
      libxrandr-dev \
      libxt-dev \
      libxtst-dev \
      make \
      nasm \
      pkg-config \
      realpath \
      ssh \
      libnuma-dev \
      numactl \
      gcc-multilib'
    )

    process.chdir('/usr/local')
    const gccBinary = await tc.downloadTool(`https://ci.adoptopenjdk.net/userContent/gcc/gcc730+ccache.x86_64.tar.xz`)
    await exec.exec(`ls -l ${gccBinary}`)
    await exec.exec(`sudo tar -xJ --strip-components=1 -C /usr/local -f ${gccBinary}`)
    await io.rmRF(`${gccBinary}`)
  
    await exec.exec(`sudo ln -s /usr/lib/x86_64-linux-gnu /usr/lib64`)
    await exec.exec(`sudo ln -s /usr/include/x86_64-linux-gnu/* /usr/local/include`)
    await exec.exec(`sudo ln -sf /usr/local/bin/g++-7.3 /usr/bin/g++`)
    await exec.exec(`sudo ln -sf /usr/local/bin/gcc-7.3 /usr/bin/gcc`)

    if (`${impl}` === 'openj9') {
      const cuda9 = await tc.downloadTool('https://developer.nvidia.com/compute/cuda/9.0/Prod/local_installers/cuda_9.0.176_384.81_linux-run')
      await exec.exec(`sudo sh ${cuda9} --silent --toolkit --override`)
      await io.rmRF(`${cuda9}`)
    }
  }
  process.chdir(`${workDir}`)
  // other installation, i.e impl
}

async function getBootJdk(javaToBuild: string, impl: string): Promise<void> {
  const bootJDKVersion = getBootJdkVersion(javaToBuild)

  if (parseInt(bootJDKVersion) > 8) {
    let bootjdkJar
    // TODO: issue open openj9,mac, 10 ga : https://api.adoptopenjdk.net/v3/binary/latest/10/ga/mac/x64/jdk/openj9/normal/adoptopenjdk doesn't work
    if (
      `${impl}` === 'openj9' &&
      `${bootJDKVersion}` === '10' &&
      `${targetOs}` === 'mac'
    ) {
      bootjdkJar = await tc.downloadTool(`https://github.com/AdoptOpenJDK/openjdk10-binaries/releases/download/jdk-10.0.2%2B13.1/OpenJDK10U-jdk_x64_mac_hotspot_10.0.2_13.tar.gz`)
    } else {
      bootjdkJar = await tc.downloadTool(`https://api.adoptopenjdk.net/v3/binary/latest/${bootJDKVersion}/ga/${targetOs}/x64/jdk/${impl}/normal/adoptopenjdk`)
    }

    await exec.exec('ls')
    if (`${targetOs}` === 'mac') {
      await exec.exec(`sudo tar -xzf ${bootjdkJar} -C ./jdk/boot --strip=3`)
    } else {
      await exec.exec(`sudo tar -xzf ${bootjdkJar} -C ./jdk/boot --strip=1`)
    }

    if (`${targetOs}` === 'mac') {
      await exec.exec(`sudo tar -xzf ${bootjdkJar} -C ./bootjdk --strip=3`)
    } else if (`${bootJDKVersion}` === '10' && `${targetOs}` === 'linux' && `${impl}` === 'openj9') {
      await exec.exec(`sudo tar -xzf ${bootjdkJar} -C ./bootjdk --strip=2`) // TODO : issue open as this is packaged differently
    } else {
      await exec.exec(`sudo tar -xzf ${bootjdkJar} -C ./bootjdk --strip=1`)
    }

    await io.rmRF(`${bootjdkJar}`)
  //  core.exportVariable('JAVA_HOME', `${workDir}/jdk/boot`) // Set environment variable JAVA_HOME, and prepend ${JAVA_HOME}/bin to PATH
  // core.addPath(`${workDir}/jdk/boot/bin`)
  } else {
    //TODO : need to update
    const jdk8Jar = await tc.downloadTool('https://api.adoptopenjdk.net/v2/binary/releases/openjdk8?os=mac&release=latest&arch=x64&heap_size=normal&type=jdk&openjdk_impl=hotspot')
    await exec.exec(`sudo tar -xzf ${jdk8Jar} -C ./jdk/home --strip=3`)
    await io.rmRF(`${jdk8Jar}`)
  }
}

function getBootJdkVersion(javaToBuild: string): string {
  let bootJDKVersion

  //latest jdk need update continually
  if (`${javaToBuild}` === 'jdk') {
    bootJDKVersion = '14'
  } else {
    bootJDKVersion = javaToBuild.replace('jdk', '')
    bootJDKVersion = bootJDKVersion.substr(0, bootJDKVersion.length - 1)
    bootJDKVersion = (parseInt(bootJDKVersion) - 1).toString()
  }
  return bootJDKVersion
}

async function printJavaVersion(javaToBuild: string): Promise<void> {
  let platform
  if (`${targetOs}` === 'linux') {
    platform = 'linux'
  } else if (`${targetOs}` === 'mac') {
    platform = 'macosx'
  } else {
    platform = 'windows'
  }
  let platformRelease = `${platform}-x86_64-normal-server-release`

  if (`${javaToBuild}` === 'jdk') {
    platformRelease = `${platform}-x86_64-server-release`
  } else {
    let version = javaToBuild.replace('jdk', '')
    version = version.substr(0, version.length - 1)
    if (parseInt(version) >= 13) platformRelease = `${platform}-x86_64-server-release` 
  }
  let jdkImages
  if (javaToBuild === 'jdk8u') {
    jdkImages = `workspace/build/src/build/${platformRelease}/images/j2sdk-image`
    process.chdir(`${jdkImages}/jre/bin`)
  } else {
    jdkImages = `workspace/build/src/build/${platformRelease}/images/jdk`
    process.chdir(`${jdkImages}/bin`)
  }
  await exec.exec(`./java -version`)
  //set outputs
  core.setOutput('BuildJDKDir', `${buildDir}/${jdkImages}`)
}
