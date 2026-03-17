CREATE TABLE `page_views` (
	`id` int AUTO_INCREMENT NOT NULL,
	`path` varchar(256) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `page_views_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `wishlists` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`productId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `wishlists_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `banners` MODIFY COLUMN `image` longtext NOT NULL;--> statement-breakpoint
ALTER TABLE `categories` MODIFY COLUMN `imageUrl` longtext;--> statement-breakpoint
ALTER TABLE `order_items` MODIFY COLUMN `productImage` longtext;--> statement-breakpoint
ALTER TABLE `products` MODIFY COLUMN `images` json;--> statement-breakpoint
ALTER TABLE `products` MODIFY COLUMN `specifications` json;--> statement-breakpoint
ALTER TABLE `announcements` ADD `image` longtext;--> statement-breakpoint
ALTER TABLE `announcements` ADD `linkUrl` varchar(512);--> statement-breakpoint
ALTER TABLE `banners` ADD `order` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `categories` ADD `featured` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `categories` ADD `order` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `orders` ADD `abandonedEmailSent` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `products` ADD `tags` json;--> statement-breakpoint
ALTER TABLE `users` ADD `password` varchar(256);--> statement-breakpoint
ALTER TABLE `users` ADD `emailVerified` boolean DEFAULT false NOT NULL;