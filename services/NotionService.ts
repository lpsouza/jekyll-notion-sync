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
    async getPosts(): Promise<any[]> {
        const databaseId = await this.getDatabaseId();
        let db = await this.notion.databases.query({ database_id: databaseId });
        let posts = db.results.map((post: any) => post);
        let hasMore = db.has_more;
        while (hasMore) {
            db = await this.notion.databases.query({ database_id: databaseId, start_cursor: db.next_cursor });
            posts.push(...db.results.map((post: any) => post));
            hasMore = db.has_more;
        }
        posts = posts.sort((a: any, b: any) => {
            return new Date(b['properties']['Created']['date']['start']).getTime() - new Date(a['properties']['Created']['date']['start']).getTime();
        });
        return posts.filter((post: any) => post['properties']['Published']['checkbox']);
    }
    async getDatabaseId(): Promise<string> {
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
}
