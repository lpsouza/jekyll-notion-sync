import { Client } from '@notionhq/client';


export class NotionService {
    private notion: Client;
    constructor() {
        this.notion = new Client({
            auth: process.env.NOTION_TOKEN
        });
    }
    async parser(post: any) {
        const database_id = await this.getDatabaseId();

        const parent = { database_id };
        const cover = post.content['attributes']['image'] != null ? { external: { url: post.content['attributes']['image'] } } : null;
        const children = [];
        const properties = {};
        properties['Author'] = { people: [{ id: process.env.NOTION_USER }] };
        properties['Created'] = { date: { start: new Date(post.content['attributes']['date']).toISOString() } };
        properties['Category'] = { select: { name: post.content['attributes']['category'] } };
        properties['Published'] = { checkbox: post.content['attributes']['published'] };
        properties['Title'] = { title: [{ text: { content: post.content['attributes']['title'] } }] };
        properties['Tags'] = { multi_select: [] };

        if (post.content['attributes']['tags']) {
            post.content['attributes']['tags'].forEach((tag: any) => {
                properties['Tags']['multi_select'].push({ name: tag });
            });
        }

        post.content['body'].split('\n').forEach(line => {
            if (line != '') {
                if (line.startsWith('###')) {
                    children.push({ heading_3: { rich_text: [{ text: { content: line.replace('###', '') } }] } });
                } else {
                    children.push({ paragraph: { rich_text: [{ text: { content: line } }] } });
                }
            }
        });

        const notionPost = { parent, cover, children, properties };
        return notionPost;
    }
    async getPosts() {
        const databaseId = await this.getDatabaseId();
        const posts = (await this.notion.databases.query({ database_id: databaseId })).results.map((post: any) => post);
        return posts;
    }
    async getDatabaseId() {
        const database = await this.notion.search({ filter: { property: 'object', value: 'database' } });
        const databaseId = database.results[0].id;
        return databaseId;
    }
    async createPost(post: any) {
        const postNotion = await this.parser(post);
        const parent = postNotion['parent'];
        const cover = postNotion['cover'];
        const children = postNotion['children'];
        const properties = postNotion['properties'];
        return this.notion.pages.create({ parent, cover, properties, children });
    }
    // async updatePost(post: any) {
    //     const page_id = post.id;
    //     const postNotion = await this.parser(post);
    //     const parent = postNotion['parent'];
    //     const cover = postNotion['cover'];
    //     const children = postNotion['children'];
    //     const properties = postNotion['properties'];
    //     // this.notion.pages.update({ page_id, cover, properties });
    //     for (const child of children) {
    //         // this.notion.blocks.update({ block_id: page_id,  });
    //         console.log(child);
    //     }
    // }
}
