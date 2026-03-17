import { Octokit } from "@octokit/rest";

// This file contains utility functions for interacting with the GitHub API using the Octokit library.
// It includes functions to create an authenticated Octokit instance, fetch user repositories, contributors, commits, pull requests, issues, repository content, package.json, file tree, and commit activity.
// Each function takes the user's access token and relevant parameters to make API calls and return the requested data.

// creates an authenticated Octokit instance using the provided access token,
// which is used to make authorized requests to the GitHub API on behalf of the user.
export function getOctokit(accessToken: string) {
  return new Octokit({
    auth: accessToken,
  });
}

// The following functions use the authenticated Octokit instance to fetch various types of data from the GitHub API,
// such as repositories, contributors, commits, pull requests, issues, repository content, package.json file, file tree, and commit activity.
export async function fetchUserRepos(accessToken: string) {
  const octokit = getOctokit(accessToken);
  const { data: repos } = await octokit.rest.repos.listForAuthenticatedUser({
    sort: "updated", //most recent updated will come first
    per_page: 100, //100 repos per page request
    type: "owner",
  });
  return repos;
}

// fetches the top 100 contributors for a given repository by making an API call to the GitHub REST endpoint for listing contributors
export async function fetchRepoContributors(
  accessToken: string,
  owner: string,
  repo: string,
) {
  const octokit = getOctokit(accessToken);
  // fetch top 100 contributors for a repo
  const { data: contributors } = await octokit.rest.repos.listContributors({
    owner,
    repo,
    per_page: 100,
  });
  return contributors;
}

// fetches the last 100 commits for a given repository by making an API call to the GitHub REST endpoint for listing commits
export async function fetchRepoCommits(
  accessToken: string,
  owner: string,
  repo: string,
) {
  const octokit = getOctokit(accessToken);
  // fetch last 100 commits for a repo
  const { data: commits } = await octokit.rest.repos.listCommits({
    owner,
    repo,
    per_page: 100,
  });
  return commits;
}

// fetches the last 100 pull requests for a given repository by making an API call to the GitHub REST endpoint for listing pull requests, including both open and closed PRs
export async function fetchRepoPullRequests(
  accessToken: string,
  owner: string,
  repo: string,
) {
  const octokit = getOctokit(accessToken);
  //state all - open and closed
  const { data: pulls } = await octokit.rest.pulls.list({
    owner,
    repo,
    state: "all",
    per_page: 100,
  });
  return pulls;
}

// fetches the last 100 issues for a given repository by making an API call to the GitHub REST endpoint for listing issues, including both open and closed issues
export async function fetchRepoIssues(
  accessToken: string,
  owner: string,
  repo: string,
) {
  const octokit = getOctokit(accessToken);
  // fetch all issues (open + closed) for a repo
  const { data: issues } = await octokit.rest.issues.listForRepo({
    owner,
    repo,
    state: "all",
    per_page: 100,
  });
  return issues;
}

// fetches the content of the root directory of a given repository by making an API call to the GitHub REST endpoint for getting repository content.
export async function fetchRepoContent(
  accessToken: string,
  owner: string,
  repo: string,
) {
  const octokit = getOctokit(accessToken);
  try {
    //go to root of the repo and fetch content
    const { data } = await octokit.rest.repos.getContent({
      owner,
      repo,
      path: "",
    });
    return Array.isArray(data) ? data : [];
  } catch (error) {
    return [];
  }
}

// fetches the package.json file from the root of a given repository, decodes it from base64, and parses it as JSON.
export async function fetchPackageJson(
  accessToken: string,
  owner: string,
  repo: string,
) {
  const octokit = getOctokit(accessToken);
  try {
    // fetch package.json from repo root
    const { data } = await octokit.rest.repos.getContent({
      owner,
      repo,
      path: "package.json",
    });
    if ("content" in data) {
      // data.content is base64 encoded
      // we decode it to get the actual JSON string
      const decoded = Buffer.from(data.content, "base64").toString("utf-8");
      return JSON.parse(decoded);
    }
    return null;
  } catch (error) {
    return null;
  }
}

// fetches the entire file tree of a given repository by first retrieving the default branch and then making a recursive API call to get all files and directories in the repository.
export async function fetchRepoFileTree(
  accessToken: string,
  owner: string,
  repo: string,
) {
  const octokit = getOctokit(accessToken);

  try {
    // Get the default branch first
    const { data: repoData } = await octokit.rest.repos.get({ owner, repo });

    // Then get the full recursive file tree
    const { data } = await octokit.rest.git.getTree({
      owner,
      repo,
      tree_sha: repoData.default_branch,
      recursive: "1", // "1" -> fetch all nested files
    });

    return data.tree;
  } catch (error) {
    return [];
  }
}

// fetches the commit activity for a given repository, which includes the number of commits made each week for the past year, by making an API call to the GitHub REST endpoint for getting commit activity stats. If the data is not ready or an error occurs, it returns an empty array.
export async function fetchCommitActivity(
  accessToken: string,
  owner: string,
  repo: string,
) {
  const octokit = getOctokit(accessToken);
  try {
    const { data, status } = await octokit.rest.repos.getCommitActivityStats({
      owner,
      repo,
    });
    // Returns array of 52 weeks
    // Each week: { week: timestamp, total: count, days: [...] }
    if (status === 202 || !data || !Array.isArray(data)) {
      return [];
    }

    return data;
  } catch (error) {
    return [];
  }
}
