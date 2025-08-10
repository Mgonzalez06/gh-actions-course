const core = require('@actions/core');
const exec = require('@actions/exec');

const validateBranchName = ({ branchName }) => /^[a-zA-Z0-9_\-\.\/]+$/.test(branchName);
const validateDirectoryName = ({ directoryName }) => /^[a-zA-Z0-9_\-\/]+$/.test(directoryName);

async function run() {
    const baseBranch = core.getInput('base-branch');
    const targetBranch = core.getInput('target-branch');
    const githubToken = core.getInput('github-token');
    const workingDirectory = core.getInput('working-directory');
    const debug = core.getInput('debug');

    core.setSecret(githubToken);

    if (!validateBranchName({ branchName: baseBranch })) {
        core.setFailed(`Invalid base-branch name: ${baseBranch}. Branch names should include only characters, numbers, underscores, hyphens, dots, and slashes.`);
        return;
    }

    if (!validateBranchName({ branchName: targetBranch })) {
        core.setFailed(`Invalid target-branch name: ${targetBranch}. Branch names should include only characters, numbers, underscores, hyphens, dots, and slashes.`);
        return;
    }

    if (!validateDirectoryName({ directoryName: workingDirectory })) {
        core.setFailed(`Invalid working-directory name: ${workingDirectory}. Directory names should include only characters, numbers, underscores, hyphens, and slashes.`);
        return;
    }

    core.info(`[js-dependency-update] Base branch is: ${baseBranch}`);
    core.info(`[js-dependency-update] Target branch is: ${targetBranch}`);
    core.info(`[js-dependency-update] Working directory is: ${workingDirectory}`);

    await exec.exec('npm update', [], {
        cwd: workingDirectory,
    });

    const gitStatus = await exec.getExecOutput('git status -s package*.json', [], {
        cwd: workingDirectory,
    });

    if (gitStatus.stdout?.length > 0) {
        core.info(`[js-dependency-update] There are updates available!`);
    } else {
        core.info(`[js-dependency-update] There are no updates available!`);
    }


    /*
    1. Parse inputs:
        1.1 base-branch from which to check for updates
        1.2 target-branch to use to create the PR
        1.3 Github Token for authentication purposes (to create PRs)
        1.4 Working directory for which to check for dependencies
    2. Execute the npm update command within the working directory
    3. Check whether there are modified package*.json files
    4. If there are modified files:
        4.1 Add and commit files to the target-branch
        4.2 Create a PR to the base-branch using the octokit API
    5. Otherwise, conclude the custom action
    */
    core.info('I am a custom JS action')
}

run();