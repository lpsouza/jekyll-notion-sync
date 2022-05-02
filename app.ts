import * as dotenv from 'dotenv';
dotenv.config();

import { NotionService } from './services/NotionService';
import { JekyllService } from './services/JekyllService';
// import table from 'cli-table';
// import color from 'cli-color';



(async () => {
    const notion = new NotionService();
    const jekyll = new JekyllService();

    // let countOk = 0;
    // let countNo = 0;
    // let countSkip = 0;
    // const filesNo = [];

    const jekyllPosts = await jekyll.getPosts();
    const notionPosts = await notion.getPosts();

    const jekyllPostsNotInNotion = jekyllPosts.filter(post => post.content['attributes'].notion_id == null);
    const jekyllPostsInNotion = jekyllPosts.filter(post => post.content['attributes'].notion_id != null);

    if (jekyllPostsNotInNotion.length > 0) {
        for (const post of jekyllPostsNotInNotion) {
            const newPost = await notion.createPost(post);
            await jekyll.updatePost(newPost, post.filename, post.sha);
        }
    }
    if (jekyllPostsInNotion.length > 0) {
        for (const post of notionPosts) {
            const jekyllPost = jekyllPostsInNotion.find(jekyllPost => jekyllPost.content['attributes'].notion_id === post.id);
            if (jekyllPost == null) {
                await jekyll.createPost(post);
            } else if (new Date(jekyllPost.content['attributes'].last_modified_at) < new Date(post['properties']['Modified']['last_edited_time'])) {
                await jekyll.updatePost(post, jekyllPost.filename, jekyllPost.sha);
            }
        }
    }

    // const status = new table();
    // status.push(['Processed posts', color.green(countOk)]);
    // status.push(['Posts with errors', color.red(countNo)]);
    // status.push(['Skipped posts', color.yellow(countSkip)]);
    // console.log(status.toString());

    // if (filesNo.length > 0) {
    //     const files = new table({ head: [color.red('File on error')] });
    //     filesNo.forEach(file => files.push([file]));
    //     console.log(files.toString());
    // }
})();
