const core = require('@actions/core');
const exec = require('@actions/exec');
const github = require('@actions/github');

/*
1. Parse inputs:
    1.1 base-branch from which to check for updates
    1.2 head-branch to use to create the PR
    1.3 Github Token for authentication purposes (to create PRs)
    1.4 Working directory for which to check for dependencies
2. Execute the npm update command within the working directory
3. Check whether there are modified package*.json files
4. If there are modified files:
    4.1 Add and commit files to the head-branch
    4.2 Create a PR to the base-branch using the octokit API
5. Otherwise, conclude the custom action
*/

const setupGit = async () => {
    await exec.exec(`git config --global user.name "gh-automation"`);
    await exec.exec(`git config --global user.email "gh-automation@github.com"`);
}

const validateBranchName = ({ branchName }) => /^[a-zA-Z0-9_\-\.\/]+$/.test(branchName);
const validateDirectoryName = ({ directoryName }) => /^[a-zA-Z0-9_\-\/]+$/.test(directoryName);

const setupLogger = ({ debug, prefix } = { debug: false, prefix: ''}) => ({
    debug: (message) => {
        if (debug) {
            core.info(`DEBUG ${prefix}${prefix ? ' : ' : ''}${message}`);
        }
    },
    info: (message) => {
        core.info(`${prefix}${prefix ? ' : ' : ''}${message}`);
    },
    error: (message) => {
        core.error(`ERROR ${prefix}${prefix ? ' : ' : ''}${message}`);
    },
});

async function run() {
    const baseBranch = core.getInput('base-branch', { required: true });
    const headBranch = core.getInput('head-branch', { required: true });
    const githubToken = core.getInput('github-token', { required: true });
    const workingDirectory = core.getInput('working-directory', { required: true });
    const debug = core.getBooleanInput('debug');
    const logger = setupLogger({ debug, prefix: '[js-dependency-update]' });

    const commonExecOpts = {
        cwd: workingDirectory,
    };

    core.setSecret(githubToken);

    logger.debug(`Validatins inputs base-branch, head-branch, and working-directory`);

    if (!validateBranchName({ branchName: baseBranch })) {
        core.setFailed(`Invalid base-branch name: ${baseBranch}. Branch names should include only characters, numbers, underscores, hyphens, dots, and slashes.`);
        return;
    }

    if (!validateBranchName({ branchName: headBranch })) {
        core.setFailed(`Invalid head-branch name: ${headBranch}. Branch names should include only characters, numbers, underscores, hyphens, dots, and slashes.`);
        return;
    }

    if (!validateDirectoryName({ directoryName: workingDirectory })) {
        core.setFailed(`Invalid working-directory name: ${workingDirectory}. Directory names should include only characters, numbers, underscores, hyphens, and slashes.`);
        return;
    }

    logger.debug(`Base branch is: ${baseBranch}`);
    logger.debug(`Head branch is: ${headBranch}`);
    logger.debug(`Working directory is: ${workingDirectory}`);

    logger.debug('Checking for package updates ...')

    await exec.exec('npm update', [], {
        ...commonExecOpts,
    });

    const gitStatus = await exec.getExecOutput('git status -s package*.json', [], {
        ...commonExecOpts,
    });

    if (gitStatus.stdout?.length > 0) {
        logger.debug('There are updates available!');
        logger.debug('Setting up git ...');
        await setupGit();

        logger.debug('Committing and pushing package*.json changes ...');
        await exec.exec(`git checkout -b ${headBranch}`, [], {
            ...commonExecOpts,
        });
        await exec.exec(`git add package.json package-lock.json`, [], {
            ...commonExecOpts,
        });
        await exec.exec(`git commit -m "chore: update dependencies"`, [], {
            ...commonExecOpts,
        });
        await exec.exec(`git push -u origin ${headBranch} --force`, [], {
            ...commonExecOpts,
        });

        logger.debug('Fetching octokit API ...');

        const octokit = github.getOctokit(githubToken);

        try {
            logger.debug(`Creating PR using head branch: ${headBranch} ...`);
            
            await octokit.rest.pulls.create({
                owner: github.context.repo.owner,
                repo: github.context.repo.repo,
                title: 'Update NPM dependencies',
                body: 'This pull request updates NPM packages',
                base: baseBranch,
                head: headBranch,
            });
        } catch (error) {
            logger.error(`Something went wrong while creating the PR. Please check the logs for more details.`);
            core.setFailed(error.message);
            logger.error(error);
        }   
    } else {
        logger.info('No updates at this point in time!');
    }
}

run();