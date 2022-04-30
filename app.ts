import * as dotenv from 'dotenv';
dotenv.config();

import { Client } from '@notionhq/client';
import { Octokit } from '@octokit/rest';
import fm from 'front-matter';
import table from 'cli-table';
import color from 'cli-color';

const notion = new Client({
    auth: process.env.NOTION_TOKEN
});

const octokit = new Octokit({
    auth: process.env.GITHUB_TOKEN
});

(async () => {
    const database = await notion.search({ filter: { property: 'object', value: 'database' } });
    const databaseId = database.results[0].id;
    const databasePosts = await notion.databases.query({ database_id: databaseId });
    const postsFromNotion = databasePosts.results.map(post => post);

    const owner = process.env.GITHUB_OWNER;
    const repo = process.env.GITHUB_REPO;
    const posts = (await octokit.rest.repos.getContent({ owner, repo, path: '_posts' })).data as any[];

    let countOk = 0;
    let countNo = 0;
    let countSkip = 0;
    const filesNo = [];

    for (const post of posts) {
        const contentEncoded = await (await octokit.rest.repos.getContent({ owner, repo, path: `_posts/${post.name}` })).data['content'];
        const contentRaw = Buffer.from(contentEncoded, 'base64').toString('utf-8');
        const content = fm(contentRaw);

        if (!postsFromNotion.find(a => a['properties']['Title']['title'][0]['plain_text'] === content.attributes['title'])) {
            const parent = { database_id: databaseId };
            const cover = content.attributes['image'] != null ? { external: { url: content.attributes['image'] } } : null;
            const children = [];
            const properties = {};
            properties['Author'] = { people: [{ id: process.env.NOTION_USER }] };
            properties['Created'] = { date: { start: new Date(content.attributes['date']).toISOString() } };
            properties['Category'] = { select: { name: content.attributes['category'] } };
            properties['Published'] = { checkbox: content.attributes['published'] };
            properties['Title'] = { title: [{ text: { content: content.attributes['title'] } }] };
            properties['Tags'] = { multi_select: [] };

            if (content.attributes['tags']) {
                content.attributes['tags'].forEach(tag => {
                    properties['Tags']['multi_select'].push({ name: tag });
                });
            }

            content.body.split('\n').forEach(line => {
                if (line != '') {
                    if (line.startsWith('###')) {
                        children.push({ heading_3: { rich_text: [{ text: { content: line.replace('###', '') } }] } });
                    } else {
                        children.push({ paragraph: { rich_text: [{ text: { content: line } }] } });
                    }
                }
            });

            try {
                const page = await notion.pages.create({ parent, cover, properties, children });
                countOk++;
            } catch (error) {
                countNo++;
                filesNo.push(post.name);
            }

        } else {
            countSkip++;
        }
    };

    const status = new table();
    status.push(['Processed posts', color.green(countOk)]);
    status.push(['Posts with errors', color.red(countNo)]);
    status.push(['Skipped posts', color.yellow(countSkip)]);
    console.log(status.toString());

    if (filesNo.length > 0) {
        const files = new table({ head: [color.red('File on error')] });
        filesNo.forEach(file => files.push([file]));
        console.log(files.toString());
    }
})();
