"""add viewed unlabeled videos as the user raw score

Revision ID: 56f15f7e1d7a
Revises: 5a5220e7bac1
Create Date: 2019-08-09 15:25:35.966502

"""
from alembic import op
import sqlalchemy as sa
import traceback

# revision identifiers, used by Alembic.
revision = '56f15f7e1d7a'
down_revision = '5a5220e7bac1'
branch_labels = None
depends_on = None


def upgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.add_column('batch', sa.Column('user_raw_score', sa.Integer(), nullable=True))
    op.add_column('connection', sa.Column('user_raw_score', sa.Integer(), nullable=True))
    op.add_column('user', sa.Column('raw_score', sa.Integer(), nullable=False))
    db = op.get_bind()
    user = sa.sql.table('user', sa.sql.column('id'), sa.sql.column('raw_score'))
    connection = sa.sql.table('connection', sa.sql.column('id'), sa.sql.column('user_id'), sa.sql.column('user_raw_score'))
    batch = sa.sql.table('batch', sa.sql.column('id'), sa.sql.column('num_unlabeled'), sa.sql.column('connection_id'), sa.sql.column('user_raw_score'))
    for b in db.execute(batch.select()):
        for c in db.execute(connection.select(connection.c.id == b.connection_id)):
            for u in db.execute(user.select(user.c.id == c.user_id)):
                print("Process batch: " + str(b.id))
                db.execute(batch.update().where(batch.c.id == b.id).values(user_raw_score=u.raw_score))
                db.execute(user.update().where(user.c.id == c.user_id).values(raw_score=u.raw_score+b.num_unlabeled))
    # ### end Alembic commands ###


def downgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.drop_column('user', 'raw_score')
    op.drop_column('connection', 'user_raw_score')
    op.drop_column('batch', 'user_raw_score')
    # ### end Alembic commands ###
