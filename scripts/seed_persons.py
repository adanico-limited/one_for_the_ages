#!/usr/bin/env python3
"""
Celebrity Data Seeder for One for the Ages (OFTA)
Seeds the database with person data and generates question templates.

Usage:
    python seed_persons.py                   # Seed all
    python seed_persons.py --dry-run         # Preview without inserting
    python seed_persons.py --persons     # Only persons
    python seed_persons.py --questions        # Only question templates
"""

import argparse
import json
import uuid
import logging
import sys
import os
from datetime import date, datetime

# Add parent dir to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from backend.ofta_core.utils.util_db import get_db_connector
import pandas as pd

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


# ────────────────────────────────────────────────
# CELEBRITY DATA
# ────────────────────────────────────────────────

PERSONS = [
    # MUSIC
    {"full_name": "Beyoncé", "date_of_birth": "1981-09-04", "star_sign": "Virgo", "primary_category": "Music", "nationality": "American", "gender": "Female", "popularity_score": 98, "hints_easy": ["She's married to Jay-Z", "Queen Bey"], "hints_medium": ["Destiny's Child alumna"], "hints_hard": ["Born in Houston, TX"]},
    {"full_name": "Drake", "date_of_birth": "1986-10-24", "star_sign": "Scorpio", "primary_category": "Music", "nationality": "Canadian", "gender": "Male", "popularity_score": 95, "hints_easy": ["Started on Degrassi", "OVO Sound founder"], "hints_medium": ["From Toronto"], "hints_hard": ["Real name: Aubrey"]},
    {"full_name": "Taylor Swift", "date_of_birth": "1989-12-13", "star_sign": "Sagittarius", "primary_category": "Music", "nationality": "American", "gender": "Female", "popularity_score": 99, "hints_easy": ["The Eras Tour", "Swifties"], "hints_medium": ["Born in West Reading, PA"], "hints_hard": ["Started in country music"]},
    {"full_name": "Ed Sheeran", "date_of_birth": "1991-02-17", "star_sign": "Aquarius", "primary_category": "Music", "nationality": "British", "gender": "Male", "popularity_score": 92, "hints_easy": ["Shape of You singer", "Red-haired British singer"], "hints_medium": ["From Suffolk, England"], "hints_hard": ["Played the Glastonbury headline set"]},
    {"full_name": "Rihanna", "date_of_birth": "1988-02-20", "star_sign": "Pisces", "primary_category": "Music", "nationality": "Barbadian", "gender": "Female", "popularity_score": 96, "hints_easy": ["Fenty Beauty founder", "Umbrella singer"], "hints_medium": ["From Barbados"], "hints_hard": ["Full name: Robyn Rihanna Fenty"]},
    {"full_name": "Adele", "date_of_birth": "1988-05-05", "star_sign": "Taurus", "primary_category": "Music", "nationality": "British", "gender": "Female", "popularity_score": 94, "hints_easy": ["Hello singer", "Albums named after her age"], "hints_medium": ["From Tottenham, London"], "hints_hard": ["Oscar winner for Skyfall"]},
    {"full_name": "Bruno Mars", "date_of_birth": "1985-10-08", "star_sign": "Libra", "primary_category": "Music", "nationality": "American", "gender": "Male", "popularity_score": 91, "hints_easy": ["24K Magic", "Uptown Funk"], "hints_medium": ["Born in Honolulu, Hawaii"], "hints_hard": ["Real name: Peter Gene Hernandez"]},
    {"full_name": "Billie Eilish", "date_of_birth": "2001-12-18", "star_sign": "Sagittarius", "primary_category": "Music", "nationality": "American", "gender": "Female", "popularity_score": 93, "hints_easy": ["Bad Guy singer", "Known for baggy clothes"], "hints_medium": ["From Los Angeles"], "hints_hard": ["Works with brother Finneas"]},
    {"full_name": "Kanye West", "date_of_birth": "1977-06-08", "star_sign": "Gemini", "primary_category": "Music", "nationality": "American", "gender": "Male", "popularity_score": 90, "hints_easy": ["Yeezy brand", "Now goes by Ye"], "hints_medium": ["Chicago rapper"], "hints_hard": ["College Dropout debut album"]},
    {"full_name": "Lady Gaga", "date_of_birth": "1986-03-28", "star_sign": "Aries", "primary_category": "Music", "nationality": "American", "gender": "Female", "popularity_score": 91, "hints_easy": ["Poker Face singer", "Born This Way"], "hints_medium": ["Starred in A Star Is Born"], "hints_hard": ["Real name: Stefani Germanotta"]},

    # MOVIES / TV
    {"full_name": "Leonardo DiCaprio", "date_of_birth": "1974-11-11", "star_sign": "Scorpio", "primary_category": "Movies", "nationality": "American", "gender": "Male", "popularity_score": 95, "hints_easy": ["Titanic star", "Won Oscar for The Revenant"], "hints_medium": ["Environmental activist"], "hints_hard": ["Born in Hollywood, LA"]},
    {"full_name": "Zendaya", "date_of_birth": "1996-09-01", "star_sign": "Virgo", "primary_category": "Movies", "nationality": "American", "gender": "Female", "popularity_score": 96, "hints_easy": ["Euphoria star", "Spider-Man: No Way Home"], "hints_medium": ["Former Disney Channel star"], "hints_hard": ["Full name: Zendaya Maree Stoermer Coleman"]},
    {"full_name": "Dwayne Johnson", "date_of_birth": "1972-05-02", "star_sign": "Taurus", "primary_category": "Movies", "nationality": "American", "gender": "Male", "popularity_score": 94, "hints_easy": ["The Rock", "Former WWE wrestler"], "hints_medium": ["Samoan heritage"], "hints_hard": ["Played for University of Miami football"]},
    {"full_name": "Tom Holland", "date_of_birth": "1996-06-01", "star_sign": "Gemini", "primary_category": "Movies", "nationality": "British", "gender": "Male", "popularity_score": 92, "hints_easy": ["Spider-Man actor", "Dating Zendaya"], "hints_medium": ["Trained in ballet and gymnastics"], "hints_hard": ["From Kingston upon Thames"]},
    {"full_name": "Margot Robbie", "date_of_birth": "1990-07-02", "star_sign": "Cancer", "primary_category": "Movies", "nationality": "Australian", "gender": "Female", "popularity_score": 92, "hints_easy": ["Barbie movie star", "Harley Quinn actress"], "hints_medium": ["From Gold Coast, Australia"], "hints_hard": ["Started on Neighbours"]},
    {"full_name": "Ryan Reynolds", "date_of_birth": "1976-10-23", "star_sign": "Scorpio", "primary_category": "Movies", "nationality": "Canadian", "gender": "Male", "popularity_score": 93, "hints_easy": ["Deadpool star", "Married to Blake Lively"], "hints_medium": ["Owns Aviation Gin"], "hints_hard": ["From Vancouver, Canada"]},
    {"full_name": "Scarlett Johansson", "date_of_birth": "1984-11-22", "star_sign": "Sagittarius", "primary_category": "Movies", "nationality": "American", "gender": "Female", "popularity_score": 90, "hints_easy": ["Black Widow actress", "MCU star"], "hints_medium": ["Voice of Lucy"], "hints_hard": ["Born in New York City"]},
    {"full_name": "Timothée Chalamet", "date_of_birth": "1995-12-27", "star_sign": "Capricorn", "primary_category": "Movies", "nationality": "American", "gender": "Male", "popularity_score": 91, "hints_easy": ["Dune star", "Wonka actor"], "hints_medium": ["French-American"], "hints_hard": ["Born in New York City"]},
    {"full_name": "Chris Hemsworth", "date_of_birth": "1983-08-11", "star_sign": "Leo", "primary_category": "Movies", "nationality": "Australian", "gender": "Male", "popularity_score": 91, "hints_easy": ["Thor actor", "Extraction star"], "hints_medium": ["Lives in Byron Bay, Australia"], "hints_hard": ["Brother is Liam Hemsworth"]},
    {"full_name": "Jennifer Lawrence", "date_of_birth": "1990-08-15", "star_sign": "Leo", "primary_category": "Movies", "nationality": "American", "gender": "Female", "popularity_score": 89, "hints_easy": ["Hunger Games star", "Youngest Best Actress Oscar winner at the time"], "hints_medium": ["Silver Linings Playbook"], "hints_hard": ["From Louisville, Kentucky"]},

    # SPORTS
    {"full_name": "Cristiano Ronaldo", "date_of_birth": "1985-02-05", "star_sign": "Aquarius", "primary_category": "Sports", "nationality": "Portuguese", "gender": "Male", "popularity_score": 99, "hints_easy": ["CR7", "Most Instagram followers"], "hints_medium": ["Born in Madeira"], "hints_hard": ["Played for Sporting, Man Utd, Real Madrid, Juventus"]},
    {"full_name": "LeBron James", "date_of_birth": "1984-12-30", "star_sign": "Capricorn", "primary_category": "Sports", "nationality": "American", "gender": "Male", "popularity_score": 96, "hints_easy": ["King James", "LA Lakers"], "hints_medium": ["From Akron, Ohio"], "hints_hard": ["Drafted straight from high school in 2003"]},
    {"full_name": "Serena Williams", "date_of_birth": "1981-09-26", "star_sign": "Libra", "primary_category": "Sports", "nationality": "American", "gender": "Female", "popularity_score": 93, "hints_easy": ["Tennis legend", "23 Grand Slam titles"], "hints_medium": ["Sister Venus is also a top player"], "hints_hard": ["Born in Saginaw, Michigan"]},
    {"full_name": "Lionel Messi", "date_of_birth": "1987-06-24", "star_sign": "Cancer", "primary_category": "Sports", "nationality": "Argentine", "gender": "Male", "popularity_score": 98, "hints_easy": ["The GOAT", "World Cup 2022 winner"], "hints_medium": ["Spent most of career at Barcelona"], "hints_hard": ["From Rosario, Argentina"]},
    {"full_name": "Lewis Hamilton", "date_of_birth": "1985-01-07", "star_sign": "Capricorn", "primary_category": "Sports", "nationality": "British", "gender": "Male", "popularity_score": 91, "hints_easy": ["F1 legend", "7-time World Champion"], "hints_medium": ["Drives for Mercedes (now Ferrari)"], "hints_hard": ["From Stevenage, England"]},
    {"full_name": "Naomi Osaka", "date_of_birth": "1997-10-16", "star_sign": "Libra", "primary_category": "Sports", "nationality": "Japanese", "gender": "Female", "popularity_score": 88, "hints_easy": ["Tennis star", "4 Grand Slam titles"], "hints_medium": ["Born in Japan, raised in US"], "hints_hard": ["Mental health advocate"]},
    {"full_name": "Kylian Mbappé", "date_of_birth": "1998-12-20", "star_sign": "Sagittarius", "primary_category": "Sports", "nationality": "French", "gender": "Male", "popularity_score": 94, "hints_easy": ["French football star", "Real Madrid striker"], "hints_medium": ["World Cup winner at 19"], "hints_hard": ["Born in Bondy, France"]},
    {"full_name": "Simone Biles", "date_of_birth": "1997-03-14", "star_sign": "Pisces", "primary_category": "Sports", "nationality": "American", "gender": "Female", "popularity_score": 90, "hints_easy": ["Gymnastics GOAT", "Most decorated gymnast"], "hints_medium": ["Tokyo 2020 withdrawal"], "hints_hard": ["From Spring, Texas"]},
    {"full_name": "Marcus Rashford", "date_of_birth": "1997-10-31", "star_sign": "Scorpio", "primary_category": "Sports", "nationality": "British", "gender": "Male", "popularity_score": 87, "hints_easy": ["Manchester United striker", "School meals campaigner"], "hints_medium": ["MBE recipient"], "hints_hard": ["From Wythenshawe, Manchester"]},
    {"full_name": "Usain Bolt", "date_of_birth": "1986-08-21", "star_sign": "Leo", "primary_category": "Sports", "nationality": "Jamaican", "gender": "Male", "popularity_score": 91, "hints_easy": ["Fastest man ever", "Lightning Bolt"], "hints_medium": ["8 Olympic gold medals"], "hints_hard": ["From Trelawny, Jamaica"]},

    # TV / ENTERTAINMENT
    {"full_name": "Kim Kardashian", "date_of_birth": "1980-10-21", "star_sign": "Libra", "primary_category": "TV", "nationality": "American", "gender": "Female", "popularity_score": 95, "hints_easy": ["Keeping Up with the Kardashians", "SKIMS founder"], "hints_medium": ["Studying law"], "hints_hard": ["Born in Los Angeles"]},
    {"full_name": "Gordon Ramsay", "date_of_birth": "1966-11-08", "star_sign": "Scorpio", "primary_category": "TV", "nationality": "British", "gender": "Male", "popularity_score": 89, "hints_easy": ["Hell's Kitchen host", "Famous chef"], "hints_medium": ["Born in Scotland"], "hints_hard": ["Former footballer"]},
    {"full_name": "Oprah Winfrey", "date_of_birth": "1954-01-29", "star_sign": "Aquarius", "primary_category": "TV", "nationality": "American", "gender": "Female", "popularity_score": 92, "hints_easy": ["Talk show queen", "Media mogul"], "hints_medium": ["OWN network founder"], "hints_hard": ["Born in Kosciusko, Mississippi"]},
    {"full_name": "David Attenborough", "date_of_birth": "1926-05-08", "star_sign": "Taurus", "primary_category": "TV", "nationality": "British", "gender": "Male", "popularity_score": 90, "hints_easy": ["Nature documentary presenter", "Planet Earth narrator"], "hints_medium": ["Knighted twice"], "hints_hard": ["Born in Isleworth, London"]},
    {"full_name": "Emma Watson", "date_of_birth": "1990-04-15", "star_sign": "Aries", "primary_category": "Movies", "nationality": "British", "gender": "Female", "popularity_score": 89, "hints_easy": ["Hermione Granger actress", "Harry Potter star"], "hints_medium": ["UN Women Goodwill Ambassador"], "hints_hard": ["Born in Paris, France"]},

    # TECH / BUSINESS
    {"full_name": "Elon Musk", "date_of_birth": "1971-06-28", "star_sign": "Cancer", "primary_category": "Business", "nationality": "South African", "gender": "Male", "popularity_score": 96, "hints_easy": ["Tesla CEO", "SpaceX founder"], "hints_medium": ["Owns X (Twitter)"], "hints_hard": ["Born in Pretoria, South Africa"]},
    {"full_name": "Mark Zuckerberg", "date_of_birth": "1984-05-14", "star_sign": "Taurus", "primary_category": "Business", "nationality": "American", "gender": "Male", "popularity_score": 88, "hints_easy": ["Facebook founder", "Meta CEO"], "hints_medium": ["Dropped out of Harvard"], "hints_hard": ["Born in White Plains, New York"]},
    {"full_name": "Jeff Bezos", "date_of_birth": "1964-01-12", "star_sign": "Capricorn", "primary_category": "Business", "nationality": "American", "gender": "Male", "popularity_score": 87, "hints_easy": ["Amazon founder", "Blue Origin rocket company"], "hints_medium": ["Washington Post owner"], "hints_hard": ["Born in Albuquerque, NM"]},

    # ROYALTY
    {"full_name": "Prince William", "date_of_birth": "1982-06-21", "star_sign": "Cancer", "primary_category": "Royalty", "nationality": "British", "gender": "Male", "popularity_score": 88, "hints_easy": ["Prince of Wales", "Married to Kate Middleton"], "hints_medium": ["Helicopter pilot"], "hints_hard": ["Born at St Mary's Hospital, Paddington"]},
    {"full_name": "Prince Harry", "date_of_birth": "1984-09-15", "star_sign": "Virgo", "primary_category": "Royalty", "nationality": "British", "gender": "Male", "popularity_score": 87, "hints_easy": ["Duke of Sussex", "Married to Meghan Markle"], "hints_medium": ["Served in Afghanistan"], "hints_hard": ["Lives in Montecito, California"]},

    # MORE MUSIC
    {"full_name": "The Weeknd", "date_of_birth": "1990-02-16", "star_sign": "Aquarius", "primary_category": "Music", "nationality": "Canadian", "gender": "Male", "popularity_score": 92, "hints_easy": ["Blinding Lights singer", "Super Bowl halftime performer"], "hints_medium": ["Ethiopian-Canadian"], "hints_hard": ["Real name: Abel Tesfaye"]},
    {"full_name": "Dua Lipa", "date_of_birth": "1995-08-22", "star_sign": "Leo", "primary_category": "Music", "nationality": "British", "gender": "Female", "popularity_score": 90, "hints_easy": ["Levitating singer", "Don't Start Now"], "hints_medium": ["Albanian-British"], "hints_hard": ["Born in London to Kosovar-Albanian parents"]},
    {"full_name": "Post Malone", "date_of_birth": "1995-07-04", "star_sign": "Cancer", "primary_category": "Music", "nationality": "American", "gender": "Male", "popularity_score": 88, "hints_easy": ["Rockstar rapper", "Known for face tattoos"], "hints_medium": ["From Grapevine, Texas"], "hints_hard": ["Real name: Austin Richard Post"]},
    {"full_name": "Harry Styles", "date_of_birth": "1994-02-01", "star_sign": "Aquarius", "primary_category": "Music", "nationality": "British", "gender": "Male", "popularity_score": 93, "hints_easy": ["One Direction member", "Watermelon Sugar singer"], "hints_medium": ["Fashion icon"], "hints_hard": ["From Holmes Chapel, Cheshire"]},
    {"full_name": "Ariana Grande", "date_of_birth": "1993-06-26", "star_sign": "Cancer", "primary_category": "Music", "nationality": "American", "gender": "Female", "popularity_score": 94, "hints_easy": ["Thank U, Next singer", "Ponytail trademark"], "hints_medium": ["Nickelodeon star (Victorious)"], "hints_hard": ["From Boca Raton, Florida"]},

    # MORE MOVIES
    {"full_name": "Will Smith", "date_of_birth": "1968-09-25", "star_sign": "Libra", "primary_category": "Movies", "nationality": "American", "gender": "Male", "popularity_score": 89, "hints_easy": ["Fresh Prince of Bel-Air", "Men in Black star"], "hints_medium": ["Oscar winner for King Richard"], "hints_hard": ["From Philadelphia"]},
    {"full_name": "Tom Hanks", "date_of_birth": "1956-07-09", "star_sign": "Cancer", "primary_category": "Movies", "nationality": "American", "gender": "Male", "popularity_score": 91, "hints_easy": ["Forrest Gump star", "Toy Story voice"], "hints_medium": ["Back-to-back Best Actor Oscars"], "hints_hard": ["Born in Concord, California"]},
    {"full_name": "Robert Downey Jr.", "date_of_birth": "1965-04-04", "star_sign": "Aries", "primary_category": "Movies", "nationality": "American", "gender": "Male", "popularity_score": 92, "hints_easy": ["Iron Man actor", "MCU star"], "hints_medium": ["Sherlock Holmes actor"], "hints_hard": ["Born in Manhattan, NYC"]},
    {"full_name": "Morgan Freeman", "date_of_birth": "1937-06-01", "star_sign": "Gemini", "primary_category": "Movies", "nationality": "American", "gender": "Male", "popularity_score": 87, "hints_easy": ["Famous voice", "The Shawshank Redemption"], "hints_medium": ["Oscar for Million Dollar Baby"], "hints_hard": ["Born in Memphis, Tennessee"]},
    {"full_name": "Samuel L. Jackson", "date_of_birth": "1948-12-21", "star_sign": "Sagittarius", "primary_category": "Movies", "nationality": "American", "gender": "Male", "popularity_score": 88, "hints_easy": ["Pulp Fiction star", "Nick Fury actor"], "hints_medium": ["Highest-grossing actor of all time"], "hints_hard": ["Born in Washington, D.C."]},
]


def calculate_difficulty(celeb: dict) -> int:
    """Calculate difficulty 1-5 based on popularity and obscurity."""
    pop = celeb.get('popularity_score', 50)
    if pop >= 95:
        return 1
    elif pop >= 90:
        return 2
    elif pop >= 85:
        return 3
    elif pop >= 80:
        return 4
    else:
        return 5


def seed_persons(db, dry_run=False):
    """Seed person data into the database."""
    logger.info(f"Seeding {len(PERSONS)} persons...")

    celeb_records = []
    for celeb in PERSONS:
        record = {
            'id': str(uuid.uuid4()),
            'full_name': celeb['full_name'],
            'date_of_birth': celeb['date_of_birth'],
            'star_sign': celeb['star_sign'],
            'primary_category': celeb['primary_category'],
            'nationality': celeb.get('nationality'),
            'gender': celeb.get('gender'),
            'popularity_score': celeb.get('popularity_score', 50.0),
            'hints_easy': json.dumps(celeb.get('hints_easy', [])),
            'hints_medium': json.dumps(celeb.get('hints_medium', [])),
            'hints_hard': json.dumps(celeb.get('hints_hard', [])),
            'is_active': True,
        }
        celeb_records.append(record)

    df = pd.DataFrame(celeb_records)

    if dry_run:
        logger.info(f"[DRY RUN] Would insert {len(df)} persons")
        logger.info(f"Categories: {df['primary_category'].value_counts().to_dict()}")
        logger.info(f"Sample:\n{df[['full_name', 'primary_category', 'date_of_birth']].head(10)}")
        return df

    # Use upsert (insert or skip on conflict)
    db.insert_df(
        table_schema='da_prod',
        table_name='ofta_person',
        df=df,
        on_conflict_do_nothing=True
    )
    logger.info(f"✅ Inserted {len(df)} persons")
    return df


def seed_question_templates(db, dry_run=False):
    """Generate question templates from person data."""
    logger.info("Generating question templates...")

    # Get all persons
    celebs_df = db.select_df("SELECT id, full_name, popularity_score FROM da_prod.ofta_person WHERE is_active = TRUE")

    if celebs_df.empty:
        logger.error("No persons found! Please seed persons first.")
        return

    logger.info(f"Found {len(celebs_df)} persons for question generation")

    questions = []

    # 1. AGE_GUESS questions (one per person)
    for _, celeb in celebs_df.iterrows():
        pop = float(celeb.get('popularity_score', 50))
        difficulty = 1 if pop >= 95 else 2 if pop >= 90 else 3 if pop >= 85 else 4

        questions.append({
            'id': str(uuid.uuid4()),
            'mode': 'AGE_GUESS',
            'person_id': str(celeb['id']),
            'person_id_a': None,
            'person_id_b': None,
            'difficulty': difficulty,
            'is_active': True,
        })

    # 2. REVERSE_SIGN questions (one per person)
    for _, celeb in celebs_df.iterrows():
        questions.append({
            'id': str(uuid.uuid4()),
            'mode': 'REVERSE_SIGN',
            'person_id': str(celeb['id']),
            'person_id_a': None,
            'person_id_b': None,
            'difficulty': 3,  # Default medium difficulty
            'is_active': True,
        })

    # 3. WHO_OLDER questions (pairs of persons)
    celeb_ids = celebs_df['id'].tolist()
    import itertools
    # Take a subset of pairs to avoid too many
    pairs = list(itertools.combinations(range(len(celeb_ids)), 2))
    import random
    random.seed(42)
    selected_pairs = random.sample(pairs, min(len(pairs), 100))

    for i, j in selected_pairs:
        questions.append({
            'id': str(uuid.uuid4()),
            'mode': 'WHO_OLDER',
            'person_id': None,
            'person_id_a': str(celeb_ids[i]),
            'person_id_b': str(celeb_ids[j]),
            'difficulty': 2,
            'is_active': True,
        })

    df = pd.DataFrame(questions)

    if dry_run:
        logger.info(f"[DRY RUN] Would insert {len(df)} question templates")
        logger.info(f"Modes: {df['mode'].value_counts().to_dict()}")
        return df

    db.insert_df(
        table_schema='da_prod',
        table_name='ofta_question_template',
        df=df,
        on_conflict_do_nothing=True
    )
    logger.info(f"✅ Inserted {len(df)} question templates")
    return df


def main():
    parser = argparse.ArgumentParser(description='Seed OFTA person data')
    parser.add_argument('--dry-run', action='store_true', help='Preview without inserting')
    parser.add_argument('--persons', action='store_true', help='Only seed persons')
    parser.add_argument('--questions', action='store_true', help='Only seed question templates')
    args = parser.parse_args()

    seed_all = not args.persons and not args.questions

    try:
        db = get_db_connector()
        logger.info("✅ Database connected")
    except Exception as e:
        logger.error(f"❌ Database connection failed: {e}")
        sys.exit(1)

    if seed_all or args.persons:
        seed_persons(db, dry_run=args.dry_run)

    if seed_all or args.questions:
        seed_question_templates(db, dry_run=args.dry_run)

    logger.info("🎉 Seeding complete!")


if __name__ == '__main__':
    main()
