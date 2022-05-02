import { IAuthor } from './IAuthor';

export interface IFrontMatter {
    notion_id: string
    layout: string,
    author: IAuthor,
    date: Date,
    last_modified_at: Date
    category: string,
    published: boolean,
    title: string,
    tags: string[],
    image: string
}
