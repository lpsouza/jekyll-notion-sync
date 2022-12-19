import * as dotenv from 'dotenv';
dotenv.config();

import { NotionService } from './services/NotionService';
import { JekyllService } from './services/JekyllService';
import table from 'cli-table';



(async () => {
    const notion = new NotionService();
    const jekyll = new JekyllService();

    const counters = {
        newPostsOnNotion: 0,
        newPostsOnJekyll: 0,
        updatedPostsOnJekyll: 0
    };

    const jekyllPosts = await jekyll.getPosts();
    const notionPosts = await notion.getPosts();

    const jekyllPostsNotInNotion = jekyllPosts.filter(post => post.content['attributes'].notion_id == null);
    const jekyllPostsInNotion = jekyllPosts.filter(post => post.content['attributes'].notion_id != null);

    if (jekyllPostsNotInNotion.length > 0) {
        for (const post of jekyllPostsNotInNotion) {
            const newPost = await notion.createPost(post);
            await jekyll.updatePost(newPost, post.filename, post.sha);
            counters.newPostsOnNotion++;
        }
    }

    if (jekyllPostsInNotion.length > 0) {
        for (const post of notionPosts) {
            const jekyllPost = jekyllPostsInNotion.find(jekyllPost => jekyllPost.content['attributes'].notion_id === post.id);
            if (jekyllPost == null) {
                await jekyll.createPost(post);
                counters.newPostsOnJekyll++;
            } else if (new Date(jekyllPost.content['attributes'].last_modified_at) < new Date(post['properties']['Modified']['last_edited_time'])) {
                await jekyll.updatePost(post, jekyll.createFilename(post), jekyllPost.sha);
                counters.updatedPostsOnJekyll++;
            }
        }
    }

    const status = new table();
    status.push(['New posts on Jekyll', counters.newPostsOnJekyll]);
    status.push(['New posts on Notion', counters.newPostsOnNotion]);
    status.push(['Updated posts on Jekyll', counters.updatedPostsOnJekyll]);
    console.log(status.toString());
})();
