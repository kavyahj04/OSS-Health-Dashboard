import { Octokit } from "@octokit/rest";

export function getOctokit(accessToken: string) {
    return new Octokit({
        auth: accessToken,
    });
}

export async function fetchUserRepos(accessToken:string) {
    const octokit = getOctokit(accessToken);
    const {data : repos} = await octokit.rest.repos.listForAuthenticatedUser({
        sort : "updated",//most recent updated will come first
        per_page: 100 //100 repos per page request
    })
    return repos
}

export async function fetchRepoContributors(accessToken:string, owner:string, repo:string){
    const octokit = getOctokit(accessToken);

    const {data : contributors} = await octokit.rest.repos.listContributors({owner, repo, per_page : 100})
    return contributors
}

export async function fetchRepoCommits(accessToken:string, owner: string, repo: string) {
    const octokit = getOctokit(accessToken);
    const {data : commits} = await octokit.rest.repos.listCommits({owner, repo, per_page : 100})
    return commits
}

export async function fetchRepoPullRequests(accessToken:string, owner: string, repo: string) {
    const octokit =  getOctokit(accessToken);
    //state all - open and closed 
    const {data: pulls} = await octokit.rest.pulls.list({owner, repo, state : "all", per_page:100})
    return pulls
}

export async function fetchRepoIssues(accessToken: string, owner: string, repo: string)
{
    const octokit = getOctokit(accessToken);
    const {data : issues} = await octokit.rest.issues.listForRepo({owner, repo, state:"all", per_page: 100})
    return issues
}