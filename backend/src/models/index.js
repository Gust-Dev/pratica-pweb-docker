import fs from 'fs';
import path from 'path';
import Sequelize from 'sequelize';
import configFile from '../config/config.js';

const env = process.env.NODE_ENV || 'development';
const config = configFile[env];
const bd = {};

const sequelize = new Sequelize(
  config.database,
  config.username,
  config.password,
  config
);

const __dirname = path.resolve();
for (const file of fs.readdirSync(path.join(__dirname, 'src/models'))) {
  if (file !== 'index.js' && file.endsWith('.js')) {
    const model = (await import(`./${file}`)).default(sequelize, Sequelize.DataTypes);
    bd[model.name] = model;
  }
}

bd.sequelize = sequelize;
bd.Sequelize = Sequelize;

export default bd;