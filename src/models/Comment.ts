/**
 * Comment/note on a task
 */
export interface Comment {
  id: string;
  taskId: string;
  content: string;
  author: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Input for creating a comment
 */
export interface CreateCommentInput {
  taskId: string;
  content: string;
  author?: string;
}

/**
 * Input for updating a comment
 */
export interface UpdateCommentInput {
  content?: string;
}
