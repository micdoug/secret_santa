/* This file configures a local sqlite database used to store user information. */

import Sequelize from "sequelize";

export const database = new Sequelize({
    dialect: 'sqlite',
    storage: './database.sqlite',
    logging: false,
});

export const Contact = database.define('contact', {
    id: {
        type: Sequelize.STRING,
        allowNull: false,
        primaryKey: true
    },
    name: {
        type: Sequelize.STRING,
        allowNull: false
    },
    state: {
        type: Sequelize.INTEGER,
        allowNull: false
    },
    friend: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: '',
    }
});

try {
    // ensures that the database is created and is in sync with the defined model
    await database.sync();
} catch (error) {
    console.log("Error while trying to sync the Sequelize model with the local database.");
    console.log(error);
    process.exit(1);
}
