const core = require('@actions/core');
const exec = require('@actions/exec');
const github = require('@actions/github');

const validateBranchName = ({ branchName }) => /^[a-zA-Z0-9_\-\.\/]+$/.test(branchName);
const validateDirectoryName = ({ directoryName }) => /^[a-zA-Z0-9_\-\/]+$/.test(directoryName);

async function run() {
    const baseBranch = core.getInput('base-branch', { required: true });
    const targetBranch = core.getInput('target-branch');
    const githubToken = core.getInput('github-token', { required: true });
    const workingDirectory = core.getInput('working-directory', { required: true });
    const debug = core.getInput('debug');

    const commonExecOpts = {
        cwd: workingDirectory,
    };



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
        ...commonExecOpts,
    });

    const gitStatus = await exec.getExecOutput('git status -s package*.json', [], {
        ...commonExecOpts,
    });

    if (gitStatus.stdout?.length > 0) {
        core.info(`[js-dependency-update] There are updates available!`);
        await exec.exec(`git config --global user.name "gh-automation"`);
        await exec.exec(`git config --global user.email "gh-automation@github.com"`);
        await exec.exec(`git checkout -b ${targetBranch}`, [], {
            ...commonExecOpts,
        });
        await exec.exec(`git add package.json package-lock.json`, [], {
            ...commonExecOpts,
        });
        await exec.exec(`git commit -m "chore: update dependencies"`, [], {
            ...commonExecOpts,
        });
        await exec.exec(`git push -u origin ${targetBranch} --force`, [], {
            ...commonExecOpts,
        });

        const octokit = github.getOctokit(githubToken);

        try {
            await octokit.rest.pulls.create({
                owner: github.context.repo.owner,
                repo: github.context.repo.repo,
                title: 'Update NPM dependencies',
                body: 'This pull request updates NPM packages',
                base: baseBranch,
                head: targetBranch,
            });
        } catch (error) {
            core.error(`[js-dependency-update]: Something went wrong while creating the PR. Please check the logs for more details.`);
            core.setFailed(error.message);
            core.error(error);
        }   
    } else {
        core.info(`[js-dependency-update] No updates at this point in time!`);
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
}

run();