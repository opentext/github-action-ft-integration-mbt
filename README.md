## 1. Introduction 🚀

In the following documentation, the **OpenText Core Software Delivery Platform** and **OpenText Software Delivery Management** will collectively be referred to as 'the product'.

This is a custom GitHub Action which facilitates communication between GitHub and the product (formerly known as ALM Octane/ValueEdge) regarding CI/CD. 
The action will enable your GitHub repository to trigger MBT test runs and synchronize results with OpenText SDP/SDM.

## 2. Table of Contents

- [1. Introduction](#1-introduction)
- [2. Table of Contents](#2-table-of-contents)
- [3. Requirements](#3-requirements)
- [4. GitHub Workflow Setup](#4-github-workflow-setup)
  - [4.1. Workflow creation](#41-workflow-creation)
  - [4.2. Full YML Example](#42-full-yml-example)
  - [4.3. Workflow Parameters](#43-workflow-parameters)
  - [4.4. Debugging](#44-debugging)
- [5. Credentials Configuration](#5-credentials-configuration)
  - [5.1. Creating a GitHub App](#51-creating-a-github-app)
  - [5.2. Installing a GitHub App](#52-installing-a-github-app)
  - [5.3. Configure the Credentials in the product](#53-configure-the-credentials-in-the-product)
- [6. Running MBT Tests](#6-running-mbt-tests)
  - [6.1. GitHub self-hosted runner](#61-gitHub-self-hosted-runner)
  - [6.2. Run the Workflow for the first time](#62-run-the-workflow-for-the-first-time)
  - [6.3. Create Models and MBT Tests](#63-create-models-and-mbt-tests)
  - [6.4. Create a Test Suite](#64-create-a-test-suite)
  - [6.5. Run the MBT Tests from the Product](#65-run-the-mbt-tests-from-the-product)
- [7. Limitations](#7-limitations)

## 3. Requirements

- At least one GitHub Actions runner allocated for running the integration.
- The recommended product version is **25.x** or **higher**
- A Windows machine with OpenText Functional Testing (formerly UFT One) application installed
- API access to the product with **CI/CD Integration** or **DevOps Admin** roles.

## 4. GitHub Workflow Setup

This section explains how to create and configure a GitHub Actions workflow that integrates OpenText Functional Testing with Model-Based Testing (MBT). 

### 4.1. Workflow creation

> [!NOTE]
> These steps should be done inside your GitHub repository which contains the OpenText Functional Testing (formerly UFT One) tests.

- Create a new workflow from GitHub **Actions** tab (resulting in a new `.yml` file inside of `<your_repo>/.github/workflows/` subfolder).
- Add `workflow_dispatch` event trigger to allow manual workflow run
- Add `push` event trigger to allow automatic workflow run on every content change.

```yaml
on:
  workflow_dispatch:
    inputs: 
      # more details in the next step
      ...
  push:
    branches: main  # or other branches
```
- Under `inputs` section, 4 input parameters must be added (see next example).

```yaml
on:
  workflow_dispatch:
    inputs:
      testsToRun:
        description: 'Tests to run (from OpenText SDP/SDM)'
        required: true
        default: '...'
      suiteRunId:
        description: 'Suite Run Id (from OpenText SDP/SDM)'
        required: true
        default: '0'
      executionId:
        description: 'Execution Id (from OpenText SDP/SDM)'
        required: true
        default: '0'
      suiteId:
        description: 'Suite Id (from OpenText SDP/SDM)'
        required: true
        default: '0'
```
> [!NOTE]
> When the user will run a TestSuite from product, the product will automatically send a `workflow_dispatch` event to the GitHub workflow, with a payload containing the 4 parameters and values. 
> Even if the user manully runs the workflow from GitHub Actions, the default value of these 4 parameters must not be changed by user.

- If the product is configured on HTTPS with a self-signed certificate, configure node to allow requests to the server.

```yaml
env: 
    NODE_TLS_REJECT_UNAUTHORIZED: 0
```
- In the `jobs` section add a job for `github-action-ft-integration-mbt` and make sure the `runs-on` property contains at least the `self-hosted` value.
- Configure two secret variables named `SDP_CLIENT_ID` and `SDP_CLIENT_SECRET` with the credentials, inside your GitHub repository (more details about
secret variables configuration [here](https://docs.github.com/en/actions/security-guides/encrypted-secrets)).
- Set integration config params (the product's URL, Shared Space, Workspace, credentials) and repository (Token).
- For Private repositories go to ```Settings -> Actions -> General``` and set your GITHUB_TOKEN permissions to Read and write. This is necessary to access the actions scope. (more details about GITHUB_TOKEN permissions [here](https://docs.github.com/en/actions/security-guides/automatic-token-authentication#permissions-for-the-github_token))

```yaml
jobs:
  ft_integration_job:
    runs-on: <runner_tags>
    name: GHA-FT-Integ-MBT#${{github.event.action}}#${{github.event.workflow_run.id}} # you can use a static / constant value too
    steps:
      - name: GitHub Action FT Integration MBT
        uses: opentext/github-action-ft-integration-mbt@main # you can use the last released version instead of main
        id: gha-ft-integration-mbt
        with:
          octaneUrl: <sdp_octane_URL>
          octaneSharedSpace: <sdp_shared_space_id>
          octaneWorkspace: <sdp_workspace_id>
          octaneClientId: ${{secrets.SDP_CLIENT_ID}}
          octaneClientSecret: ${{secrets.SDP_CLIENT_SECRET}}
          githubToken: ${{secrets.GITHUB_TOKEN}} # automatically generated by GitHub
          minSyncInterval: 2
          logLevel: 5
```
For more details about the parameters of `opentext/github-action-ft-integration-mbt`, please check this page:
https://github.com/MicroFocus/github-action-ft-integration-mbt/blob/main/action.yml

### 4.2. Full YML Example

Example of complete integration workflow configuration file:

```yaml
name: GitHub-Action-FT-integ-MBT
on:
  workflow_dispatch:
    inputs:
      testsToRun:
        description: 'Tests to run (from OpenText SDP/SDM)'
        required: true
        default: '...'
      suiteRunId:
        description: 'Suite Run Id (from OpenText SDP/SDM)'
        required: true
        default: '0'
      executionId:
        description: 'Execution Id (from OpenText SDP/SDM)'
        required: true
        default: '0'
      suiteId:
        description: 'Suite Id (from OpenText SDP/SDM)'
        required: true
        default: '0'    
  push:
    branches:
      - main
permissions:
  actions: read  # Explicitly grant actions:read for this workflow
  contents: read  # Retain read access to contents if needed
env: 
    NODE_TLS_REJECT_UNAUTHORIZED: 0
jobs:
  ft_integration_job:
    runs-on: self-hosted
    name: Integration-Job
    steps:
      - name: GitHub Action FT Integration MBT
        uses: opentext/github-action-ft-integration-mbt@main 	# or use a release version instead of main
        id: gha-ft-integration
        with:
          octaneUrl: 'https://qa8.almoctane.com'
          octaneSharedSpace: 1001
          octaneWorkspace: 1003
          octaneClientId: ${{secrets.SDP_CLIENT_ID}}
          octaneClientSecret: ${{secrets.SDP_CLIENT_SECRET}}
          githubToken: ${{secrets.GITHUB_TOKEN}}
          minSyncInterval: 2
          logLevel: 5
```

- Run the desired workflow(s) from **Actions** Tab. This will create a new `CI Server` and `Test Runner` inside the product, reflecting the status of the executed workflow.

### 4.3. Workflow Parameters

Ensure the workflow includes the 4 required parameters:
- `testsToRun` (default: '...')
- `suiteId` (default: '0')
- `suiteRunId` (default: '0')
- `executionId` (default: '0')
> [!NOTE]
> When the user will run a TestSuite from product, the product will automatically send a `workflow_dispatch` event to the GitHub workflow, with a payload containing 4 parameters and values. 
> Even if the user manully runs the workflow from GitHub Actions, the default value of these 4 parameters must not be changed by user.

### 4.4. Debugging

- In order to get more information on the execution of the integration workflow, add this parameter for the integration job: `logLevel: '3'`.
- These are the available values for this parameter:
  - `1` - *trace* level
  - `2` - *debug* level
  - `3` - *info* level (default)
  - `4` - *warning* level
  - `5` - *error* level

## 5. Credentials Configuration

To use certain features, the product needs to send requests to GitHub. 
This requires configuring GitHub App credentials and adding them to the application.

### 5.1. Creating a GitHub App

1. On GitHub, go to your organization (or account, if the repository containing the workflows is owned by an account) settings.
2. In the left-side menu, go to **Developer Settings -> GitHub Apps**.
3. Create a new GitHub App by clicking the **New GitHub App**.
4. In the **GitHub App name** field, enter a name of your choice.
5. In the **Homepage URL** field, enter the URL of the Opentext Core Software Delivery Platform.
6. In the **Webhook** section, uncheck the **Active** option. No webhook is needed.
7. In the **Permissions** section, grant the following repository permissions:
  - `Actions`: Read and write
  - `Content`: Read-only
8. Click the **Create GitHub App** button at the bottom of the page. Leave any other fields unchanged.

### 5.2. Installing a GitHub App

1. On GitHub, go to your organization (or account, if the repository containing the workflows is owned by an account) settings.
2. Go to **Developer settings -> GitHub Apps**.
3. Select the `GitHub App` you created in the previous step by clicking its name.
4. In the left-side menu, go to **Install App**.
5. For the organization (or account) you want to configure the credentials for, click the **Install** button.
6. Select the repositories you want to grant access to: **All repositories** or **Only select repositories**
7. Click the `Install` button to complete the installation.

### 5.3. Configure the credentials in the product

1. On GitHub, go to your organization (or account, if the repository containing the workflows is owned by an account) settings.
2. Go to **Developer Settings -> GitHub Apps** and select the GitHub App you installed by clicking its name.
3. On the current page, note the value of the **Client ID**.
4. In the **Private keys** section, click the **Generate a private key** button. A file containing the `Private Key` will be downloaded to your device (usually this is a `.pem` file).
   **Note:** `Private Key`should not be confused with `Client secret` (which is not required / used).
5. Go to the OpenText Core Software Delivery Platform.
6. Navigate to **Settings -> Spaces** (select the desired workspace containing the CI servers) **-> Credentials**.
7. Create a new `Credentials` entity.
8. Enter a name of your choice. In the **User Name** field, enter the **Client ID** from the GitHub App, and in the **Password** field, enter the `Private Key` (the full content from `.pem` file) generated for this GitHub App.
9. Click the `Add` button to save the credentials.
10. In workspace settings, go to **DevOps -> CI Servers**.
11. For the desired **CI Server** (it has the name of the organization on GitHub), double-click the cell in the **Credential** column and select the newly created entity. If the **Credential** column is not visible, click the **Choose Columns** button (near the **Filter** button) and make the column visible.

## 6. Running MBT Tests

### 6.1. GitHub self-hosted runner

- After completing the configuration, make sure the desired GitHub self-hosted runner is active, from GitHub **Settings -> Actions -> Runners**
- To set up a GitHub self-hosted runner, follow the instructions provided in GitHub's documentation:
  1. Visit the Adding self-hosted runners guide: https://docs.github.com/en/actions/how-tos/manage-runners/self-hosted-runners/add-runners
  2. Understand the prerequisites and select the machine you will use for your self-hosted runner.
  3. Follow the steps to add a self-hosted runner at the repository, organization, or enterprise level.
- If you'd like to learn more about self-hosted runners, their configuration, and management, see the following resources:
    - Managing self-hosted runners: https://docs.github.com/en/actions/how-tos/manage-runners/self-hosted-runners
    - About self-hosted runners: https://docs.github.com/en/actions/concepts/runners/self-hosted-runners

### 6.2. Run the Workflow for the first time

- After completing the configuration, run your workflow once, manually, from GitHub **Actions** tab.
  - The **CI Server** and **Test Runner** entities will be automatically created in the product
  - The `Test Discovery` and `Synchronization` mechanisms will be triggered, so that all FT tests' `Actions` from current repo will be collected and injected as `Units` in the product.
- You can manually rerun the Workflow anytime, or it will be automatically triggered by `push` events.
  - Then, the `Test Discovery` and `Synchronization` mechanisms will be triggered again (if the `minSyncInterval` minutes has elapsed since the last sync).

- Example of **Credentials** entity created at step [5.3. Configure the Credentials in the product](#53-configure-the-credentials-in-the-product):

<table><tr><td style="border: 2px solid #ccc; padding: 4px;"><img src="https://github.com/user-attachments/assets/20a406a5-7587-47be-a5a2-62d8c9b630ee" alt="Credential" title="Credential" width="500" /></td></tr></table>

- Make sure a `Release` entity exists, otherwise create it (required to Run a **Test Suite**):

<table><tr><td style="border: 2px solid #ccc; padding: 4px;"><img src="https://github.com/user-attachments/assets/d7baddce-58e3-4460-9e91-28989488475c" alt="Release" title="Release" width="500" /></td></tr></table>

- Make sure the **CI Server** is using the appropriate the `Credentials` entity:

<table><tr><td style="border: 2px solid #ccc; padding: 4px;"><img src="https://github.com/user-attachments/assets/720ae3e8-3df6-41ed-8e30-e1ee73a21af5" alt="CI Server" title="CI Server" width="500" /></td></tr></table>

- Select the **Test Runner** and click `Sync with CI`:

<table><tr><td style="border: 2px solid #ccc; padding: 4px;"><img src="https://github.com/user-attachments/assets/9cad0353-fef8-4a00-b63a-9f032faa8c03" alt="Test Runner" title="Test Runner" width="500" /></td></tr></table>

- Optionally, review the **Test Runner** details:

<table><tr><td style="border: 2px solid #ccc; padding: 4px;"><img src="https://github.com/user-attachments/assets/258a1333-f01d-4049-bb0d-34e1a4ccf258" alt="Test Runner" title="Test Runner" width="500" /></td></tr></table>

### 6.3. Create Models and MBT Tests

- In the product, navigate to the **Model-Based Testing** module, create a new **Model** entity, add the desired **Units** and link them
- Example of **Model** entity:

<table><tr><td style="border: 2px solid #ccc; padding: 4px;"><img src="https://github.com/user-attachments/assets/4d98e82c-9e8c-44b0-9b45-c1aff9d2af84" alt="Model" title="Model" width="500" /></td></tr></table>

- To generate the **MBT Test** entities, open the `Paths` tab, select the desired items, then click `Generate Test`:

<table><tr><td style="border: 2px solid #ccc; padding: 4px;"><img src="https://github.com/user-attachments/assets/6dd441b9-5921-4433-b7d2-fbfb8e7faf4c" alt="Generate MBT Test" title="Generate MBT Test" width="500" /></td></tr></table>

- After generating the **MBT Test**, the column `Covered by test` should be populated like this:

<table><tr><td style="border: 2px solid #ccc; padding: 4px;"><img src="https://github.com/user-attachments/assets/5c95fc84-7943-444e-8828-f4633ed903fe" alt="MBT Test" title="MBT Test" width="500" /></td></tr></table>

### 6.4. Create a Test Suite

- Open the **Execution** or **Quality** module and go to `Tests` tab:

<table><tr><td style="border: 2px solid #ccc; padding: 4px;"><img src="https://github.com/user-attachments/assets/bfd317c8-0601-4f3d-b978-0cbae7d29121" alt="Tests" title="Tests" width="500" /></td></tr></table>

- Create a **Test Suite** entity if you don't have one, then assign the relevant **MBT Test** entries to it.

<table><tr><td style="border: 2px solid #ccc; padding: 4px;"><img src="https://github.com/user-attachments/assets/9ba9802f-85ac-47eb-a911-ba9850b6c5ec" alt="Test Suite" title="Test Suite" width="500" /></td></tr></table>

- Make sure the `Run Mode` is set to `Automatically`, and update **Test Suite** like this:

<table><tr><td style="border: 2px solid #ccc; padding: 4px;"><img src="https://github.com/user-attachments/assets/064a650b-89a9-47fa-8bdb-9dda7ebbf57b" alt="Test Suite" title="Test Suite" width="500" /></td></tr></table>

### 6.5. Run the MBT Tests from the Product

- In the product, select or open the test suite and click `Run Suite`.

<table><tr><td style="border: 2px solid #ccc; padding: 4px;"><img src="https://github.com/user-attachments/assets/e80451df-8379-476b-92ac-f7d4b17e1e2a" alt="Test Suite" title="Test Suite" width="500" /></td></tr></table>

## 7. Limitations

1. One self-hosted GitHub runner is required to execute the integration workflow.
2. Within a single workspace, you can only have one MBT Test Runner associated with each GitHub repository. Therefore: 
   - Before setting up the opentext/github-action-ft-integration-mbt to run MBT tests from a specific repository, make sure no existing MBT Test Runner in the same workspace is assigned to the same repository. 
   - Since the MBT Test Runner creation depends on the YML workflow you use, make sure to create only one YML workflow per GitHub repository. An attempt sync to a second branch (using a second YML workflow) will fail." 
