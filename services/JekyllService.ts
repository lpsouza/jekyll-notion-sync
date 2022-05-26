import * as YAML from 'yaml';
import fm from 'front-matter';
import slugify from 'slugify';
import { Octokit } from '@octokit/rest';
import { Client } from '@notionhq/client';

import { IFrontMatter } from '../interfaces/IFrontMatter';
import { IJekyllPost } from '../interfaces/IJekyllPost';

export class JekyllService {
    private octokit: Octokit;
    private notion: Client;
    private github: { owner: string; repo: string; path: string; };
    constructor() {
        this.octokit = new Octokit({
            auth: process.env.GITHUB_TOKEN
        });
        this.notion = new Client({
            auth: process.env.NOTION_TOKEN
        });
        this.github = {
            owner: process.env.GITHUB_OWNER,
            repo: process.env.GITHUB_REPO,
            path: process.env.GITHUB_PATH
        }
    }
    async parser(post: any) {
        const frontMatter: IFrontMatter = {
            notion_id: post.id,
            layout: 'post',
            author: post['properties']['Author']['people'].length == 0 ? null : {
                id: post['properties']['Author']['people'][0]['id'],
                name: post['properties']['Author']['people'][0]['name'],
                avatarUrl: post['properties']['Author']['people'][0]['avatar_url']
            },
            date: new Date(post['properties']['Created']['date']['start']),
            last_modified_at: new Date(post['properties']['Modified']['last_edited_time']),
            category: post['properties']['Category']['select']['name'],
            published: post['properties']['Published']['checkbox'],
            title: post['properties']['Title']['title'][0]['plain_text'],
            tags: [],
            image: post['cover'] != null ? post['cover']['external']['url'] : null,
        }

        const tags = post['properties']['Tags']['multi_select'];
        tags.forEach(tag => {
            frontMatter.tags.push(tag['name']);
        });

        const yaml = new YAML.Document();
        yaml.contents = frontMatter;
        let content = '---\n';
        content += yaml.toString();
        content += '---\n\n';
        const postBlocks = await this.notion.blocks.children.list({ block_id: post.id });
        const blocks = postBlocks.results.map(block => block);
        for (let i = 0; i < blocks.length; i++) {
            const block = blocks[i];
            switch (block['type']) {
                case 'paragraph':
                    const paragraphRichText = block['paragraph']['rich_text'];
                    if (paragraphRichText.length > 0) {
                        paragraphRichText.forEach(text => {
                            content += text['href'] == null ? text['plain_text'] : `[${text['plain_text']}](${text['href']})`;
                        });
                        content += '\n\n';
                    }
                    break;

                case 'heading_3':
                    const headingRichText = block['heading_3']['rich_text'];
                    if (headingRichText.length > 0) {
                        headingRichText.forEach(text => {
                            content += text['href'] == null ? `### ${text['plain_text']}` : `### [${text['plain_text']}](${text['href']})`;
                        });
                        content += '\n\n';
                    }
                    break;

                case 'image':
                    const captionBlock = block['image']['caption'];
                    let caption = '';
                    if (captionBlock.length > 0) {
                        captionBlock.forEach(text => {
                            caption += text['href'] == null ? text['plain_text'] : `[${text['plain_text']}](${text['href']})`;
                        });
                    }
                    switch (block['image']['type']) {
                        case 'file':
                            content += `![${caption}](${block['image']['file']['url']})`;
                            content += caption != '' ? `\n${caption}\n\n` : '\n\n';
                            break;

                        case 'external':
                            content += `![${caption}](${block['image']['external']['url']})`;
                            content += caption != '' ? `\n${caption}\n\n` : '\n\n';
                            break;

                        default:
                            break;
                    }
                    break;

                default:
                    break;
            }
        };

        return content;
    }
    createFilename(post: IJekyllPost): string {
        return `${new Date(post['properties']['Created']['date']['start']).toISOString().split('T')[0]}-${slugify(post['properties']['Title']['title'][0]['plain_text']).toLowerCase()}.md`;
    }
    async getPosts(): Promise<IJekyllPost[]> {
        const owner = this.github.owner;
        const repo = this.github.repo;
        const path = this.github.path;
        const postsOnGithub = (await this.octokit.rest.repos.getContent({ owner, repo, path })).data as any[];
        const posts = [];
        for (const post of postsOnGithub) {
            const filename = post.name;
            const sha = post.sha;
            const contentEncoded = await (await this.octokit.rest.repos.getContent({ owner, repo, path: `${path}/${post.name}` })).data['content'];
            const content = fm(Buffer.from(contentEncoded, 'base64').toString());
            posts.push({ filename, sha, content });
        }
        return posts;
    }
    async createPost(post: any) {
        const owner = this.github.owner;
        const repo = this.github.repo;
        const path = this.github.path;
        const filename = this.createFilename(post);
        const content = await this.parser(post);
        try {
            this.octokit.rest.repos.createOrUpdateFileContents({ owner, repo, path: `${path}/${filename}`, message: `Create ${filename}`, content: Buffer.from(content).toString('base64') });
        } catch (error) {
            console.log(error.message);
        }
    }
    async updatePost(post: any, filename: string, sha: string) {
        const owner = this.github.owner;
        const repo = this.github.repo;
        const path = this.github.path;
        const content = await this.parser(post);
        try {
            this.octokit.rest.repos.createOrUpdateFileContents({ owner, repo, path: `${path}/${filename}`, message: `Update ${filename}`, content: Buffer.from(content).toString('base64'), sha });
        } catch (error) {
            console.log(error.message);
        }
    }
}